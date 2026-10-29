async function returnRequest(token, path, { signal, values } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (values) {
    const response = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Could not prepare the secure request.");
    }

    const csrf = await response.json();
    headers[csrf.headerName] = csrf.token;
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api/returns${path}`, {
    method: values ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values ? JSON.stringify(values) : undefined,
  });

  if (!response.ok) {
    const messages = {
      400: "Select an item and enter a reason of up to 1,000 characters.",
      401: "Please sign in again.",
      403: "The security check failed. Please try again.",
      404: "Order or purchased item not found.",
      409: "This item is no longer eligible or already has a return request. Refresh the list.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not confirm the request. Refresh your requests before submitting again.",
    );
  }

  return response.json();
}

export const getEligibleReturns = (token, page, signal, orderId = null) =>
  returnRequest(
    token,
    `/eligible?page=${page}&size=10${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ""}`,
    { signal },
  );

export const getReturnRequests = (token, page, signal, orderId = null) =>
  returnRequest(
    token,
    `?page=${page}&size=10${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ""}`,
    { signal },
  );

export const submitReturn = (token, values) =>
  returnRequest(token, "", { values });
