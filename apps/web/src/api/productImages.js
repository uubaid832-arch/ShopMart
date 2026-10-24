async function imageRequest(
  path,
  { token, method = "GET", body, signal } = {},
) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (method !== "GET") {
    const prepared = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });

    if (!prepared.ok) {
      throw new Error("Could not prepare the secure request.");
    }

    const csrf = await prepared.json();

    if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
      throw new Error("Unexpected security response.");
    }

    headers[csrf.headerName] = csrf.token;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body,
    signal,
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const messages = {
      400: "Use JPEG/PNG images up to 5 MB, 6000 pixels per side and 16 megapixels. Maximum six photos per product.",
      401: "Please sign in again.",
      403: "Administrator access is required. Try signing in again.",
      404: "This product or image was not found. Refresh and try again.",
      413: "Each image must be 5 MB or less.",
      415: "Select JPEG or PNG images.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not complete the image request. Please try again.",
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected product image response.");
  }

  return data;
}

export function getCatalogImages(productIds, signal) {
  const ids = [...new Set(productIds)];

  if (!ids.length) return Promise.resolve([]);

  const query = new URLSearchParams({
    productIds: ids.join(","),
  });

  return imageRequest(`/product-images?${query}`, { signal });
}

export const getAdminProductImages = (token, productId, signal) =>
  imageRequest(`/admin/products/${productId}/images`, {
    token,
    signal,
  });

export function uploadProductImages(token, productId, files) {
  const body = new FormData();

  files.forEach((file) => body.append("files", file));

  return imageRequest(`/admin/products/${productId}/images`, {
    token,
    method: "POST",
    body,
  });
}

export const setPrimaryProductImage = (token, productId, imageId) =>
  imageRequest(`/admin/products/${productId}/images/${imageId}/primary`, {
    token,
    method: "PATCH",
  });

export const deleteProductImage = (token, productId, imageId) =>
  imageRequest(`/admin/products/${productId}/images/${imageId}`, {
    token,
    method: "DELETE",
  });
