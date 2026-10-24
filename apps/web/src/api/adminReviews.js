async function reviewRequest(token, path, { signal, visible } = {}) {
  const writing = typeof visible === "boolean";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (writing) {
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

  const response = await fetch(`/api/admin/reviews${path}`, {
    method: writing ? "PATCH" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: writing ? JSON.stringify({ visible }) : undefined,
  });

  if (!response.ok) {
    const messages = {
      401: "Please sign in again.",
      403: "Administrator access is required.",
      404: "Review not found.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not complete the request. Refresh and try again.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export const getAdminReviews = (token, page, signal) =>
  reviewRequest(token, `?page=${page}&size=20`, { signal });

export const setReviewVisibility = (token, id, visible) =>
  reviewRequest(token, `/${id}/visibility`, { visible });
