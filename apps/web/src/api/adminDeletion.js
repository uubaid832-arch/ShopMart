async function deleteResource(accessToken, path, conflictMessage) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure request.");
  }

  const csrf = await csrfResponse.json();

  if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
    throw new Error("Unexpected security response.");
  }

  const response = await fetch(path, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      [csrf.headerName]: csrf.token,
    },
  });

  if (!response.ok) {
    const messages = {
      400: "Invalid deletion request. Refresh the list.",
      401: "Please sign in again.",
      403: "Administrator access is required.",
      404: "This item no longer exists. Refresh the list.",
      409: conflictMessage,
    };

    throw new Error(
      messages[response.status] ??
        "Deletion could not be confirmed. Refresh the list before retrying.",
    );
  }
}

export function deleteAdminProduct(accessToken, product) {
  return deleteResource(
    accessToken,
    `/api/admin/products/${encodeURIComponent(product.id)}?version=${product.version}`,
    "This product changed or has linked records, such as an order. Refresh the list; use Edit to deactivate products that must be retained.",
  );
}

export function deleteAdminCategory(accessToken, categoryId) {
  return deleteResource(
    accessToken,
    `/api/admin/categories/${encodeURIComponent(categoryId)}`,
    "This category contains products or other linked records. Move or remove its products before deleting it.",
  );
}
