let refreshInFlight = null;

function withSessionLock(action) {
  if (navigator.locks?.request) {
    return navigator.locks.request("shopmart-auth-session", action);
  }

  return action();
}
async function sendAuthRequest(path, values, accessToken) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure request. Please try again.");
  }

  const csrf = await csrfResponse.json();

  if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
    throw new Error("The server returned an unexpected security response.");
  }

  const response = await fetch(`/api/auth/${path}`, {
    method: accessToken ? "PATCH" : "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
      ...(accessToken && {
        Authorization: `Bearer ${accessToken}`,
      }),
    },
    body: values === undefined ? undefined : JSON.stringify(values),
  });

  if (path === "refresh" && response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const messages = {
      400: accessToken
        ? "Please check your name and phone number."
        : "Please check your details and password requirements.",
      401: accessToken
        ? "Your session has expired. Please sign in again."
        : "Invalid email or password.",
      403: "The security check failed. Please try again.",
      409: "An account with this email already exists.",
      429: "Too many attempts. Please try again later.",
    };

    const otpRequest = path.includes("verify") || path.includes("resend") || path.startsWith("password/");
    const otpMessages = {
      400: path === "password/reset"
        ? "Check the code and password. The code may have expired, or the new password may match the old one."
        : "Invalid or expired code. Request a new code if needed.",
      503: "Verification email could not be sent. Please try again later.",
    };
    const failure = new Error(
      (otpRequest && otpMessages[response.status]) || messages[response.status] ||
      (response.status === 503 ? otpMessages[503] : "The request could not be completed. Please try again."),
    );
    failure.status = response.status;
    throw failure;
  }

  return response.status === 204 ? null : response.json();
}

function toSession(value) {
  if (
    typeof value?.accessToken !== "string" ||
    !value.user?.id ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0
  ) {
    throw new Error("The server returned an unexpected login response.");
  }

  return {
    ...value,
    expiresAt: Date.now() + value.expiresIn * 1000,
  };
}

export function registerAccount(values) {
  return withSessionLock(() => sendAuthRequest("register", values));
}

// Customers receive a session; riders and admins receive an OTP challenge.
export function loginAccount(values) {
  return withSessionLock(async () => {
    const result = await sendAuthRequest("login", values);
    return result?.accessToken ? toSession(result) : result;
  });
}

export function verifyLoginCode(challengeId, code) {
  return withSessionLock(async () =>
    toSession(await sendAuthRequest("login/verify", { challengeId, code })),
  );
}

export function resendLoginCode(challengeId) {
  return withSessionLock(() => sendAuthRequest("login/resend", { challengeId }));
}

export function requestPasswordReset(email) {
  return withSessionLock(() => sendAuthRequest("password/forgot", { email }));
}

export function resendPasswordReset(challengeId) {
  return withSessionLock(() => sendAuthRequest("password/resend", { challengeId }));
}

export function resetForgottenPassword(challengeId, code, newPassword) {
  return withSessionLock(() => sendAuthRequest("password/reset", { challengeId, code, newPassword }));
}

export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = withSessionLock(async () => {
      const result = await sendAuthRequest("refresh");
      return result === null ? null : toSession(result);
    }).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export function logoutAccount() {
  return withSessionLock(() => sendAuthRequest("logout"));
}
export function updateProfile(accessToken, values) {
  return withSessionLock(() => sendAuthRequest("me", values, accessToken));
}
