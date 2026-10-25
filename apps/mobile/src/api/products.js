const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

function imageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}/${url.replace(/^\/+/, "")}`;
}

async function addProductImages(products, signal) {
  // Fetch in small batches rather than making one request per card.
  for (let offset = 0; offset < products.length; offset += 20) {
    const batch = products.slice(offset, offset + 20);
    const ids = batch.map((product) => encodeURIComponent(product.id)).join(",");
    try {
      const response = await fetch(`${baseUrl}/api/product-images?productIds=${ids}`, { signal });
      if (!response.ok) throw new Error(`Image catalog returned ${response.status}.`);
      const images = await response.json();
      if (!Array.isArray(images)) throw new Error("Invalid image catalog.");
      for (const product of batch) {
        const primary = images
          .filter((image) => image.productId === product.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
        product.imageUrl = imageUrl(primary?.url);
      }
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;
      // A photo service failure should not prevent browsing or checkout.
      console.warn("ShopMart product photos:", error.message);
    }
  }
  return products;
}

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

  return addProductImages(products, signal);
}
