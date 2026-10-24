async function userRequest(
  token,
  path = "",
  { method = "GET", values, signal } = {},
) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (method !== "GET") {
    const csrfResponse = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });

    if (!csrfResponse.ok) {
      throw new Error("Could not prepare the secure request.");
    }

    const csrf = await csrfResponse.json();

    if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
      throw new Error("Unexpected security response.");
    }

    headers[csrf.headerName] = csrf.token;
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api/admin/users${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values === undefined ? undefined : JSON.stringify(values),
  });

  if (!response.ok) {
    const messages = {
      400: "Check the supplied account details.",
      401: "Please sign in again.",
      403: "Administrator access is required. Administrator accounts cannot be changed here.",
      404: "User not found.",
      409:
        method === "POST"
          ? "An account with this email already exists."
          : "The account changed or the rider has active deliveries. Refresh the list and resolve active assignments before disabling a rider.",
    };

    throw new Error(
      messages[response.status] ??
        "The request could not be confirmed. Refresh the list before trying again.",
    );
  }

  return response.json();
}

export function getAdminUsers(
  token,
  { page = 0, size = 10, search = "", role = "ALL" } = {},
  signal,
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    search,
    role,
  });

  return userRequest(token, `?${params}`, { signal });
}

export function createRider(token, values) {
  return userRequest(token, "/riders", {
    method: "POST",
    values,
  });
}

export function updateUserEnabled(token, user) {
  return userRequest(token, `/${encodeURIComponent(user.id)}/enabled`, {
    method: "PATCH",
    values: {
      enabled: !user.enabled,
      version: user.version,
    },
  });
}
