import { useContext, useEffect, useRef, useState } from "react";
import { SessionContext } from "./SessionContext";
import { logoutAccount, refreshSession, updateProfile } from "../../api/auth";

export function useSessionState() {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const logoutPending = useRef(false);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 5000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let active = true;

    refreshSession()
      .then((restored) => {
        if (active) setSession(restored);
      })
      .catch(() => {
        if (active) {
          setError("Could not restore sign-in. Please try signing in again.");
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
      });

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
        const renewed = await refreshSession();

        if (active) {
          setSession(renewed);

          if (!renewed) {
            setError("Your session has ended. Please sign in again.");
          }
        }
      } catch {
        if (active) {
          setSession(null);
          setError("Could not renew sign-in. Please sign in again.");
        }
      } finally {
        pending = false;
      }
    }

    const timeout = window.setTimeout(
      renew,
      Math.max(0, session.expiresAt - Date.now() - 60_000),
    );

    function checkOnReturn() {
      if (
        document.visibilityState === "visible" &&
        Date.now() >= session.expiresAt - 60_000
      ) {
        renew();
      }
    }

    document.addEventListener("visibilitychange", checkOnReturn);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, [session]);

  function signIn(authenticatedSession) {
    setError("");
    setSession(authenticatedSession);
    setNotice({
      type: "success",
      message: `Welcome, ${authenticatedSession.user.name}. You’re signed in.`,
    });
  }

  async function signOut() {
    if (logoutPending.current) return false;

    logoutPending.current = true;
    setError("");

    try {
      await logoutAccount();
      setSession(null);
      setNotice({
        type: "success",
        message: "You have signed out successfully.",
      });
      return true;
    } catch {
      const message = "Sign out could not be completed. Please try again.";

      setError(message);
      setNotice({ type: "error", message });

      setSession((current) => (current ? { ...current } : null));
      return false;
    } finally {
      logoutPending.current = false;
    }
  }

  async function saveProfile(values) {
    if (!session || logoutPending.current) {
      throw new Error("Please sign in again.");
    }

    const user = await updateProfile(session.accessToken, values);

    setSession((current) =>
      current?.user.id === user.id ? { ...current, user } : current,
    );

    return user;
  }

  return {
    session,
    restoring,
    error,
    signIn,
    signOut,
    saveProfile,
    notice,
    dismissNotice: () => setNotice(null),
  };
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession requires SessionProvider.");
  }

  return context;
}
