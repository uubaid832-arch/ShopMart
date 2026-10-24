async function productRequest(
  accessToken,
  path = "",
  { method = "GET", values, signal } = {},
) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (method !== "GET") {
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

  const response = await fetch(`/api/admin/products${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values === undefined ? undefined : JSON.stringify(values),
  });

  if (!response.ok) {
    const messages = {
      400: "Check the product name, category, price and stock.",
      401: "Please sign in again.",
      403: "Access denied. Check your administrator sign-in.",
      404: "Product not found.",
      409: "This product changed. Close the form, refresh the list and edit again.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not confirm the request. Refresh the list before trying again.",
    );
  }

  return response.json();
}

export async function getAdminProducts(accessToken, signal) {
  const items = [];
  let page = 0;
  let totalPages;

  do {
    const result = await productRequest(accessToken, `?page=${page}&size=100`, {
      signal,
    });

    items.push(
      ...result.items.map((product) => ({
        ...product,
        price: Number(product.price),
      })),
    );

    totalPages = result.totalPages;
    page += 1;
  } while (page < totalPages);

  return items;
}

export function saveAdminProduct(accessToken, productId, values) {
  return productRequest(accessToken, productId ? `/${productId}` : "", {
    method: productId ? "PUT" : "POST",
    values,
  });
}
