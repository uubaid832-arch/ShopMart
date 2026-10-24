const STORAGE_KEY = "shopmart-appearance-v1";

const defaults = {
  mode: "system",
  accent: "violet",
};

const modes = ["light", "dark", "system"];
const accents = ["violet", "blue", "green", "orange"];
const listeners = new Set();

const media =
  typeof window !== "undefined"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)") ?? null)
    : null;

function normalize(value) {
  return {
    mode: modes.includes(value?.mode) ? value.mode : defaults.mode,
    accent: accents.includes(value?.accent) ? value.accent : defaults.accent,
  };
}

function readSaved(fallback = defaults) {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return normalize(fallback);
  }
}

function resolve(preference) {
  return {
    ...preference,
    theme:
      preference.mode === "system"
        ? media?.matches
          ? "dark"
          : "light"
        : preference.mode,
  };
}

let current = resolve(readSaved());

function apply(next) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = next.theme;
  document.documentElement.dataset.accent = next.accent;
  document.documentElement.style.colorScheme = next.theme;
}

function publish(preference) {
  const next = resolve(normalize(preference));
  apply(next);

  if (
    next.mode === current.mode &&
    next.accent === current.accent &&
    next.theme === current.theme
  ) {
    return;
  }

  current = next;
  listeners.forEach((listener) => listener());
}

function systemChanged() {
  if (current.mode === "system") {
    publish(current);
  }
}

function storageChanged(event) {
  try {
    if (
      event.storageArea === localStorage &&
      (event.key === STORAGE_KEY || event.key === null)
    ) {
      publish(readSaved());
    }
  } catch {
    // Browser storage may be unavailable.
  }
}

export function subscribeAppearance(listener) {
  listeners.add(listener);

  if (listeners.size === 1 && typeof window !== "undefined") {
    media?.addEventListener("change", systemChanged);
    window.addEventListener("storage", storageChanged);
    publish(readSaved(current));
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && typeof window !== "undefined") {
      media?.removeEventListener("change", systemChanged);
      window.removeEventListener("storage", storageChanged);
    }
  };
}

export function getAppearance() {
  return current;
}

export function updateAppearance(values) {
  const next = normalize({ ...current, ...values });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Appearance still changes when storage is unavailable.
  }

  publish(next);
}

apply(current);
