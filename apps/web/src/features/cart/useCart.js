import { useStoredList } from "../../hooks/useStoredList";
const STORAGE_KEY = "shopmart-cart-v1";
function restoreCart(products, storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");

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

export function useCart(products, userId = null) {
  const storageKey = userId ? `${STORAGE_KEY}:user:${userId}` : STORAGE_KEY;

  const [items, setItems] = useStoredList(storageKey, (key) =>
    restoreCart(products, key),
  );

  // Keep addItem and all remaining functions below.
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
  function clearCart() {
    setItems([]);
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
    clearCart,
  };
}
