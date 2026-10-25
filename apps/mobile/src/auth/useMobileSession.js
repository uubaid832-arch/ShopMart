import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "shopmart.mobile.refresh";
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

let queue = Promise.resolve();
let refreshInFlight = null;

function sequential(action) {
  const result = queue.then(action);
  queue = result.catch(() => {});
  return result;
}

async function request(path, values) {
  if (!baseUrl) {
    throw new Error("The mobile API address is missing.");
  }

  const response = await fetch(`${baseUrl}/api/mobile/auth/${path}`, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    const messages = {
      400: "Check your details. Passwords must contain 8–72 characters.",
      401:
        path === "login"
          ? "Invalid email or password."
          : "Your session has expired. Please sign in again.",
      409: "An account with this email already exists.",
      429: "Too many attempts. Please try again later.",
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

  return {
    accessToken: value.accessToken,
    user: value.user,
    expiresAt: Date.now() + value.expiresIn * 1000,
  };
}

function restoreSession() {
  if (!refreshInFlight) {
    refreshInFlight = sequential(async () => {
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY);
      if (!refreshToken) return null;

      try {
        return await saveSession(await request("refresh", { refreshToken }));
      } catch (error) {
        if ([400, 401].includes(error.status)) {
          await SecureStore.deleteItemAsync(STORAGE_KEY);
          return null;
        }

        throw error;
      }
    }).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export function registerMobileAccount(values) {
  return request("register", values);
}

export function useMobileSession() {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const logoutPending = useRef(false);

  useEffect(() => {
    let active = true;

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
    async function clearLocalSession() {
      await sequential(() => SecureStore.deleteItemAsync(STORAGE_KEY));
      setSession(null);
      setError("");
    }

    return () => {
      active = false;
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
          setSession(null);
          setError("Could not renew sign-in. Please sign in again.");
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
    const value = await sequential(async () =>
      saveSession(await request("login", values)),
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
      await sequential(async () => {
        const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY);

        if (refreshToken) {
          await request("logout", { refreshToken });
        }

        await SecureStore.deleteItemAsync(STORAGE_KEY);
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
    await sequential(() => SecureStore.deleteItemAsync(STORAGE_KEY));
    setSession(null);
    setError("");
  }
  return {
    session,
    restoring,
    signingOut,
    error,
    signIn,
    signOut,
    updateUser,
    clearLocalSession,
  };
}
