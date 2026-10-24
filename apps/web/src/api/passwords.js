async function passwordRequest(accessToken, path, values, resetting = false) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure request.");
  }

  const csrf = await csrfResponse.json();

  if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
    throw new Error("Unexpected security response.");
  }

  const response = await fetch(path, {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    const messages = {
      400: resetting
        ? "Use a different password with at least 8 characters and no more than 72 UTF-8 bytes."
        : "Check your current password. The new password must be different, with at least 8 characters and no more than 72 UTF-8 bytes.",
      401: "Please sign in again.",
      403: "Access denied. Only administrators can reset rider passwords.",
      404: "Rider account not found.",
    };

    throw new Error(
      messages[response.status] ??
        "The password change could not be confirmed. Try signing in with the new password before repeating the request.",
    );
  }
}

export function changePassword(accessToken, values) {
  return passwordRequest(accessToken, "/api/auth/password", values);
}

export function resetRiderPassword(accessToken, riderId, newPassword) {
  return passwordRequest(
    accessToken,
    `/api/admin/users/${encodeURIComponent(riderId)}/password`,
    { newPassword },
    true,
  );
}
