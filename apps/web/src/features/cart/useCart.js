import { useEffect, useState } from "react";

const STORAGE_KEY = "shopmart-cart-v1";

function restoreCart(products) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

    if (!Array.isArray(saved)) return [];

    const quantities = new Map();

    for (const entry of saved) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !Number.isInteger(entry.quantity) ||
        entry.quantity < 1
      ) {
        continue;
      }

      const product = products.find((product) => product.id === entry.id);

      if (!product || product.stock <= 0) continue;

      const previousQuantity = quantities.get(product.id) ?? 0;

      quantities.set(
        product.id,
        Math.min(previousQuantity + entry.quantity, product.stock),
      );
    }

    return products
      .filter((product) => quantities.has(product.id))
      .map((product) => ({
        ...product,
        quantity: quantities.get(product.id),
      }));
  } catch {
    return [];
  }
}

export function useCart(products) {
  const [items, setItems] = useState(() => restoreCart(products));

  useEffect(() => {
    try {
      // Save identifiers and quantities.
      // Prices and stock come from the current product list.
      const savedItems = items.map(({ id, quantity }) => ({
        id,
        quantity,
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
    } catch {
      // Cart remains usable in memory if browser storage is unavailable.
    }
  }, [items]);

  function addItem(product) {
    const currentProduct = products.find((item) => item.id === product.id);

    if (!currentProduct || currentProduct.stock <= 0) return;

    setItems((current) => {
      const existing = current.find((item) => item.id === currentProduct.id);

      if (!existing) {
        return [...current, { ...currentProduct, quantity: 1 }];
      }

      if (existing.quantity >= currentProduct.stock) return current;

      return current.map((item) =>
        item.id === currentProduct.id
          ? { ...currentProduct, quantity: item.quantity + 1 }
          : item,
      );
    });
  }

  function changeQuantity(id, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1) return;

    setItems((current) =>
      current.map((item) => {
        if (item.id !== id || quantity > item.stock) return item;

        return { ...item, quantity };
      }),
    );
  }

  function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return {
    items,
    count,
    total,
    addItem,
    changeQuantity,
    removeItem,
  };
}
