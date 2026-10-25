import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

let writes = Promise.resolve();

export function useMobileWishlist(userId, enabled = true) {
  const key = `shopmart-mobile-wishlist:${userId || "guest"}`;
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    async function restore() {
      try {
        await writes;
        const text = await AsyncStorage.getItem(key);
        let ids = [];

        try {
          const parsed = JSON.parse(text || "[]");
          if (Array.isArray(parsed)) {
            ids = [...new Set(parsed.filter((id) => typeof id === "string"))];
          }
        } catch {
          // Ignore malformed saved data.
        }

        if (active) {
          setSaved({ key, ids });
          setError("");
        }
      } catch {
        if (active) {
          setSaved({ key, ids: [] });
          setError("Could not restore saved products.");
        }
      }
    }

    restore();

    return () => {
      active = false;
    };
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || saved?.key !== key) return;

    let active = true;
    const value = JSON.stringify(saved.ids);

    const operation = writes.then(() => AsyncStorage.setItem(key, value));

    writes = operation.catch(() => {});

    operation.catch(() => {
      if (active) setError("Could not save your wishlist on this phone.");
    });

    return () => {
      active = false;
    };
  }, [saved, key, enabled]);

  const loading = !enabled || saved?.key !== key;
  const ids = loading ? [] : saved.ids;

  function toggleItem(id) {
    if (loading) return;

    setError("");
    setSaved((current) => {
      if (current?.key !== key) return current;

      return {
        key,
        ids: current.ids.includes(id)
          ? current.ids.filter((value) => value !== id)
          : [...current.ids, id],
      };
    });
  }

  return {
    loading,
    error,
    hasItem: (id) => ids.includes(id),
    toggleItem,
  };
}
