async function riderRequest(
  token,
  path,
  { signal, method = "GET", body } = {},
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
      throw new Error("Unexpected security response. Please try again.");
    }

    headers[csrf.headerName] = csrf.token;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api/rider/deliveries${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const messages = {
      400: "Check the selected reason and note.",
      401: "Please sign in again.",
      403: "Access denied. Check your rider sign-in.",
      404: "This delivery is no longer assigned to you.",
      409: "The delivery has changed. Refresh before trying again.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not complete the request. Please try again.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export const getRiderDeliveries = (token, page, signal) =>
  riderRequest(token, `?page=${page}&size=20`, { signal });

export const completeRiderDelivery = (token, id) =>
  riderRequest(token, `/${id}/complete`, { method: "PATCH" });

export const reportFailedDelivery = (token, id, values) =>
  riderRequest(token, `/${id}/failed`, {
    method: "PATCH",
    body: values,
  });
