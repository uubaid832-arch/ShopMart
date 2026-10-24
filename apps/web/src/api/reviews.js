async function reviewRequest(
  productId,
  { token, path = "", values, signal } = {},
) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

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

  const response = await fetch(`/api/products/${productId}/reviews${path}`, {
    method: values ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values ? JSON.stringify(values) : undefined,
  });

  if (!response.ok) {
    const messages = {
      400: "Enter a rating from 1 to 5 and a review of up to 2,000 characters.",
      401: "Please sign in again.",
      403: "The security check failed. Please try again.",
      404: "Product not found.",
      409: "You have already reviewed this product or are not eligible.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not complete the request. Refresh reviews before trying again.",
    );
  }

  return response.json();
}

export const getProductReviews = (productId, page, signal) =>
  reviewRequest(productId, {
    path: `?page=${page}&size=5`,
    signal,
  });

export const getReviewEligibility = (productId, token, signal) =>
  reviewRequest(productId, {
    path: "/eligibility",
    token,
    signal,
  });

export const submitProductReview = (productId, token, values) =>
  reviewRequest(productId, { token, values });
