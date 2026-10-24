import { useEffect, useState } from "react";

export function useStoredList(key, restore) {
  const [stored, setStored] = useState(() => ({
    key,
    value: restore(key),
  }));

  // Switch lists before rendering when the signed-in account changes.
  if (stored.key !== key) {
    setStored({ key, value: restore(key) });
  }

  useEffect(() => {
    if (stored.key !== key) return;

    try {
      localStorage.setItem(key, JSON.stringify(stored.value));
    } catch {
      // Keep working in memory when storage is unavailable.
    }
  }, [key, stored]);

  function setValue(update) {
    setStored((current) => {
      const value = current.key === key ? current.value : restore(key);

      return {
        key,
        value: typeof update === "function" ? update(value) : update,
      };
    });
  }

  return [stored.value, setValue];
}
