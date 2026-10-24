import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

function normalize(saved, products) {
  const quantities = new Map();

  for (const entry of saved) {
    if (
      typeof entry?.id !== "string" ||
      !Number.isInteger(entry.quantity) ||
      entry.quantity < 1
    ) {
      continue;
    }

    const product = products.find((item) => item.id === entry.id);
    if (!product || product.stock <= 0) continue;

    quantities.set(
      entry.id,
      Math.min(
        (quantities.get(entry.id) ?? 0) + entry.quantity,
        product.stock,
        999,
      ),
    );
  }

  return [...quantities].map(([id, quantity]) => ({
    ...products.find((product) => product.id === id),
    quantity,
  }));
}

export function useMobileCart(products, userId, enabled = true) {
  const key = `shopmart-cart:${userId ?? "guest"}`;
  const ready = enabled && products !== null;
  const [stored, setStored] = useState(null);

  useEffect(() => {
    if (!ready) return;

    let active = true;

    AsyncStorage.getItem(key)
      .then((value) => {
        let items = [];

        try {
          const saved = JSON.parse(value ?? "[]");
          if (Array.isArray(saved)) items = saved;
        } catch {
          // Ignore invalid saved data.
        }

        if (active) setStored({ key, items });
      })
      .catch(() => {
        if (active) setStored({ key, items: [] });
      });

    return () => {
      active = false;
    };
  }, [key, ready]);

  useEffect(() => {
    if (!ready || stored?.key !== key) return;

    AsyncStorage.setItem(key, JSON.stringify(stored.items)).catch(() => {
      // Cart remains usable in memory.
    });
  }, [key, ready, stored]);

  const loading = !ready || stored?.key !== key;
  const items = loading ? [] : normalize(stored.items, products);

  function updateItems(action) {
    if (loading) return;

    setStored((current) => {
      if (current?.key !== key) return current;

      const updated = action(normalize(current.items, products));

      return {
        key,
        items: updated.map(({ id, quantity }) => ({ id, quantity })),
      };
    });
  }

  function addItem(id) {
    const product = products?.find((item) => item.id === id);
    if (!product || product.stock <= 0) return;

    updateItems((current) => {
      const existing = current.find((item) => item.id === id);

      if (!existing) {
        return [...current, { ...product, quantity: 1 }];
      }

      if (existing.quantity >= Math.min(product.stock, 999)) {
        return current;
      }

      return current.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      );
    });
  }

  function changeQuantity(id, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1) return;

    updateItems((current) =>
      current.map((item) =>
        item.id === id && quantity <= Math.min(item.stock, 999)
          ? { ...item, quantity }
          : item,
      ),
    );
  }

  function removeItem(id) {
    updateItems((current) => current.filter((item) => item.id !== id));
  }

  return {
    items,
    loading,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    quantityFor: (id) => items.find((item) => item.id === id)?.quantity ?? 0,
    addItem,
    changeQuantity,
    removeItem,
    clearCart: () => updateItems(() => []),
  };
}
