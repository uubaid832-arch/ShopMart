import { useStoredList } from "../../hooks/useStoredList";

const STORAGE_KEY = "shopmart-wishlist-v1";

function restoreWishlist(products, storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");

    if (!Array.isArray(saved)) return [];

    const validIds = new Set(products.map((product) => product.id));

    return [...new Set(saved)].filter((id) => validIds.has(id));
  } catch {
    return [];
  }
}

export function useWishlist(products, userId = null) {
  const storageKey = userId ? `${STORAGE_KEY}:user:${userId}` : STORAGE_KEY;

  const [ids, setIds] = useStoredList(storageKey, (key) =>
    restoreWishlist(products, key),
  );

  // Keep toggleItem and all remaining functions below.
  function toggleItem(id) {
    if (!products.some((product) => product.id === id)) return;

    setIds((current) =>
      current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [...current, id],
    );
  }

  function removeItem(id) {
    setIds((current) => current.filter((savedId) => savedId !== id));
  }

  const items = products.filter((product) => ids.includes(product.id));

  return {
    items,
    count: items.length,
    hasItem: (id) => ids.includes(id),
    toggleItem,
    removeItem,
  };
}
