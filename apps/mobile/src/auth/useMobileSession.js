import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "shopmart.mobile.refresh";
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

let queue = Promise.resolve();
let refreshInFlight = null;
let currentSession = null;
const sessionListeners = new Set();
let sessionCleanup = async () => {};

export function registerSessionCleanup(cleanup) {
  sessionCleanup = cleanup;
}
export function observeMobileSession(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}
function publishSession(value) {
  currentSession = value;
  for (const listener of sessionListeners) listener(value);
}
async function forgetSession() {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
  publishSession(null);
}

function sequential(action) {
  const result = queue.then(action);
  queue = result.catch(() => {});
  return result;
}

async function request(path, values) {
  if (!baseUrl) {
    throw new Error("The mobile API address is missing.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(`${baseUrl}/api/mobile/auth/${path}`, {
      signal: controller.signal,
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const messages = {
      400: (path.startsWith("login/") || path.startsWith("register/"))
        ? "Invalid or expired code. Try again or start a new sign-in."
        : "Check your details. Passwords must contain 8–72 characters.",
      401:
        path === "login"
          ? "Invalid email or password."
          : "Your session has expired. Please sign in again.",
      409: "An account with this email already exists.",
      429: "Too many attempts. Please wait before trying again.",
      503: "Email delivery is unavailable. Please try again later.",
    };

    const error = new Error(
      messages[response.status] ?? "The request failed. Please try again.",
    );

    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

async function saveSession(value) {
  if (
    typeof value.accessToken !== "string" ||
    typeof value.refreshToken !== "string" ||
    !value.user?.id ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0
  ) {
    throw new Error("Unexpected sign-in response.");
  }

  await SecureStore.setItemAsync(STORAGE_KEY, value.refreshToken);

  const session = {
    accessToken: value.accessToken,
    user: value.user,
    expiresAt: Date.now() + value.expiresIn * 1000,
  };
  publishSession(session);
  return session;
}

async function readAndRefreshSession() {
  const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!refreshToken) {
    publishSession(null);
    return null;
  }
  try {
    return await saveSession(await request("refresh", { refreshToken }));
  } catch (error) {
    if ([400, 401].includes(error.status)) {
      await forgetSession();
      return null;
    }
    throw error;
  }
}
function restoreSession() {
  if (!refreshInFlight) {
    refreshInFlight = sequential(readAndRefreshSession).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Background GPS and foreground authentication share the same refresh-token queue.
// Include the upload in this queue so logout cannot race an in-flight upload.
export function withRiderSession(userId, action) {
  return sequential(async () => {
    let value = currentSession;
    if (!value || value.expiresAt <= Date.now() + 60000)
      value = await readAndRefreshSession();
    if (!value || value.user.id !== userId || value.user.role !== "RIDER") {
      const error = new Error(
        "Rider sign-in is no longer available. Location sharing stopped.",
      );
      error.status = 401;
      throw error;
    }
    return action(value.accessToken);
  });
}

export function registerMobileAccount(values) {
  return request("register", values);
}

export function resendMobileSignIn(challengeId) {
  return request("login/resend", { challengeId });
}

export function useMobileSession() {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const logoutPending = useRef(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = observeMobileSession((value) => {
      if (active && !logoutPending.current) setSession(value);
    });

    restoreSession()
      .then((value) => {
        if (active) setSession(value);
      })
      .catch(() => {
        if (active) {
          setError("Could not restore sign-in. Check your connection.");
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;
    let pending = false;

    async function renew() {
      if (pending || logoutPending.current) return;
      pending = true;

      try {
        const value = await restoreSession();

        if (active && !logoutPending.current) {
          setSession(value);

          if (!value) {
            setError("Your session has expired. Please sign in again.");
          }
        }
      } catch {
        if (active && !logoutPending.current) {
          // A temporary network error must not discard a valid refresh session.
          setError(
            "Could not renew sign-in. Check your connection and reopen ShopMart.",
          );
        }
      } finally {
        pending = false;
      }
    }

    const timer = setTimeout(
      renew,
      Math.max(0, session.expiresAt - Date.now() - 60_000),
    );

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() >= session.expiresAt - 60_000) {
        renew();
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [session]);

  async function signIn(values) {
    const result = await sequential(async () => {
      const response = await request("login", values);
      if (response?.challengeId) {
        if (
          !Number.isFinite(Date.parse(response.expiresAt)) ||
          !Number.isFinite(Date.parse(response.resendAt))
        ) {
          throw new Error("Unexpected verification response.");
        }
        return { requiresOtp: true, ...response };
      }
      return { requiresOtp: false, session: await saveSession(response) };
    });

    setError("");
    if (result.requiresOtp) return result;
    setSession(result.session);
    return null;
  }

  async function verifySignIn(values) {
    const value = await sequential(async () =>
      saveSession(await request("login/verify", values)),
    );
    setError("");
    setSession(value);
  }

  async function signOut() {
    if (logoutPending.current) return;

    logoutPending.current = true;
    setSigningOut(true);
    setError("");

    try {
      await sessionCleanup();
      await sequential(async () => {
        const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY);

        if (refreshToken) {
          await request("logout", { refreshToken });
        }

        await forgetSession();
      });

      setSession(null);
    } catch {
      setError("Could not sign out. Please try again.");
      setSession((current) => (current ? { ...current } : null));
    } finally {
      logoutPending.current = false;
      setSigningOut(false);
    }
  }
  function updateUser(user) {
    setSession((current) =>
      current?.user.id === user.id ? { ...current, user } : current,
    );
  }
  async function clearLocalSession() {
    await sessionCleanup();
    await sequential(forgetSession);
    setSession(null);
    setError("");
  }
  return {
    session,
    restoring,
    signingOut,
    error,
    signIn,
    verifySignIn,
    signOut,
    updateUser,
    clearLocalSession,
  };
}

export const verifyMobileRegistration = values => request("register/verify", values);
export const resendMobileRegistration = challengeId => request("register/resend", {challengeId});
