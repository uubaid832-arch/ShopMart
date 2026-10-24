export async function getCategories(signal) {
  const response = await fetch("/api/categories", { signal });

  if (!response.ok) {
    throw new Error(`Could not load categories (HTTP ${response.status}).`);
  }

  const data = await response.json();

  if (
    !Array.isArray(data.items) ||
    data.items.some(
      (category) =>
        typeof category.id !== "string" || typeof category.name !== "string",
    )
  ) {
    throw new Error("The category API returned an unexpected response.");
  }

  return data.items;
}
