import { useEffect, useState } from "react";

const STORAGE_KEY = "shopmart-wishlist-v1";

function restoreWishlist(products) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

    if (!Array.isArray(saved)) return [];

    const validIds = new Set(products.map((product) => product.id));

    return [...new Set(saved)].filter((id) => validIds.has(id));
  } catch {
    return [];
  }
}

export function useWishlist(products) {
  const [ids, setIds] = useState(() => restoreWishlist(products));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Wishlist remains usable if browser storage is unavailable.
    }
  }, [ids]);

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
