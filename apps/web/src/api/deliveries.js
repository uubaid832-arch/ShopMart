async function deliveryRequest(
  token,
  path,
  { signal, method = "GET", values } = {},
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
  }

  if (values !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api/admin/deliveries${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values === undefined ? undefined : JSON.stringify(values),
  });

  if (!response.ok) {
    const messages = {
      400: "Check the details. Phone numbers must contain exactly 11 digits.",
      401: "Please sign in again.",
      403: "Administrator access is required.",
      404: "This order was not found.",
      409: "The order has changed or this action is unavailable. Refresh deliveries.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not complete the request. Please try again.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export const getAdminDeliveries = (token, page, signal) =>
  deliveryRequest(token, `?page=${page}&size=20`, { signal });

export const getDeliveryRiders = (token, signal) =>
  deliveryRequest(token, "/riders", { signal });

export const assignDeliveryRider = (token, orderId, riderId) =>
  deliveryRequest(token, `/${orderId}/assignment`, {
    method: "PUT",
    values: { riderId },
  });

export const updateDeliveryDetails = (token, orderId, values) =>
  deliveryRequest(token, `/${orderId}/details`, {
    method: "PATCH",
    values,
  });
