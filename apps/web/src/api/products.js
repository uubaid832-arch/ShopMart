import { getCatalogImages } from "./productImages.js";

export async function getProducts(signal) {
  const products = [];
  let page = 0;
  let totalPages;

  do {
    const response = await fetch(`/api/products?page=${page}&size=100`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`Could not load products (HTTP ${response.status}).`);
    }

    const data = await response.json();

    if (
      !Array.isArray(data.items) ||
      !Number.isInteger(data.totalPages) ||
      data.totalPages < 0
    ) {
      throw new Error("The product API returned an unexpected response.");
    }

    const photos = await getCatalogImages(
      data.items.map((product) => product.id),
      signal,
    );

    const byProduct = new Map();

    for (const photo of photos) {
      const group = byProduct.get(photo.productId) ?? [];
      group.push(photo);
      byProduct.set(photo.productId, group);
    }

    products.push(
      ...data.items.map((product) => {
        const price = Number(product.price);

        if (
          !product.id ||
          !product.category?.name ||
          !Number.isFinite(price) ||
          price <= 0 ||
          product.currency !== "PKR"
        ) {
          throw new Error("A product contains unsupported or invalid data.");
        }

        const images = (byProduct.get(product.id) ?? []).sort(
          (a, b) => a.position - b.position,
        );

        return {
          ...product,
          categoryId: product.category.id,
          category: product.category.name,
          price,
          images,
          imageUrl: images[0]?.url ?? null,
        };
      }),
    );

    totalPages = data.totalPages;
    page += 1;
  } while (page < totalPages);

  return products;
}
