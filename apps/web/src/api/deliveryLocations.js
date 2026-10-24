async function locationRequest(
  token,
  path,
  { method = "GET", values, signal } = {},
) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (method !== "GET") {
    const response = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new Error("Could not prepare the secure location request.");
    }

    const csrf = await response.json();
    headers[csrf.headerName] = csrf.token;

    if (values !== undefined) {
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values === undefined ? undefined : JSON.stringify(values),
  });

  if (!response.ok) {
    const messages = {
      400: "The device returned invalid location details.",
      401: "Please sign in again.",
      403: "Location access was denied. Check your account permissions.",
      404: "This order is unavailable or no longer assigned to you.",
      409: "Location sharing is unavailable at this delivery stage.",
    };

    throw new Error(
      messages[response.status] ??
        "The location request could not be completed.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export function updateDeliveryLocation(token, orderId, values) {
  return locationRequest(
    token,
    `/api/rider/deliveries/${encodeURIComponent(orderId)}/location`,
    { method: "PUT", values },
  );
}

export function stopDeliveryLocation(token, orderId) {
  return locationRequest(
    token,
    `/api/rider/deliveries/${encodeURIComponent(orderId)}/location`,
    { method: "DELETE" },
  );
}

export function getDeliveryLocation(token, orderId, signal) {
  return locationRequest(
    token,
    `/api/orders/${encodeURIComponent(orderId)}/location`,
    { signal },
  );
}
