const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

async function orderRequest(accessToken, path = "", { values, signal } = {}) {
  if (!baseUrl) {
    throw new Error("The mobile API address is missing.");
  }

  const response = await fetch(`${baseUrl}/api/mobile/orders${path}`, {
    method: values ? "POST" : "GET",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(values && { "Content-Type": "application/json" }),
    },
    signal,
    body: values ? JSON.stringify(values) : undefined,
  });

  if (!response.ok) {
    const messages = {
      400: "Please check your details.",
      401: "Please sign in again.",
      403: "Access denied.",
      404: "Order not found.",
      409: "Stock or product availability changed. Refresh your cart.",
    };

    const error = new Error(
      messages[response.status] ??
        "The request could not be confirmed. Please try again.",
    );

    error.status = response.status;
    throw error;
  }

  return response.json();
}

export const placeMobileOrder = (token, values) =>
  orderRequest(token, "", { values });

export const getMobileOrders = (token, page, signal) =>
  orderRequest(token, `?page=${page}&size=10`, { signal });

export const getMobileTracking = (token, id, signal) =>
  orderRequest(token, `/${id}/tracking`, { signal });
