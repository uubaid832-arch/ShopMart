async function adminReturnRequest(
  token,
  path,
  { signal, status, rejectionReason } = {},
) {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (status) {
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

  const response = await fetch(`/api/admin/returns${path}`, {
    method: status ? "PATCH" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: status ? JSON.stringify({ status, rejectionReason }) : undefined,
  });

  if (!response.ok) {
    const messages = {
      400: "Select a valid return status.",
      401: "Please sign in again.",
      403: "Access denied. Check your administrator sign-in.",
      404: "Return request not found.",
      409: "This request has changed or the action is not allowed. Refresh the list.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not confirm the request. Refresh its status before trying again.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export const getAdminReturns = (token, page, signal) =>
  adminReturnRequest(token, `?page=${page}&size=20`, { signal });

export const updateAdminReturnStatus = (token, id, status, rejectionReason) =>
  adminReturnRequest(token, `/${id}/status`, { status, rejectionReason });

export async function recordCodRefund(token, id, reference) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure request.");
  }

  const csrf = await csrfResponse.json();

  const response = await fetch(`/api/admin/returns/${id}/refund`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ reference }),
  });

  if (!response.ok) {
    const messages = {
      400: "Enter a receipt reference of up to 200 characters.",
      401: "Please sign in again.",
      403: "Access denied. Check your administrator sign-in.",
      404: "Return request not found.",
      409: "The refund cannot be recorded in its current state. Refresh the request.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not confirm the refund record. Refresh before trying again.",
    );
  }
}
