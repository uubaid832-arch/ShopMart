const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "");

export async function getProducts(signal) {
  if (!baseUrl) {
    throw new Error("Set EXPO_PUBLIC_API_URL in the mobile .env file.");
  }

  const products = [];
  let page = 0;
  let totalPages;

  do {
    const response = await fetch(
      `${baseUrl}/api/products?page=${page}&size=100`,
      { signal },
    );

    if (!response.ok) {
      throw new Error(`Could not load products (${response.status}).`);
    }

    const data = await response.json();

    products.push(
      ...data.items.map((product) => ({
        ...product,
        category: product.category.name,
        price: Number(product.price),
      })),
    );

    totalPages = data.totalPages;
    page += 1;
  } while (page < totalPages);

  return products;
}
