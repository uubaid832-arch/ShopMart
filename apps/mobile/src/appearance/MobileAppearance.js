import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

const STORAGE_KEY = "shopmart-mobile-appearance-v1";
const DEFAULTS = { mode: "system", accent: "violet" };

const accents = {
  violet: { light: "#7c3aed", dark: "#a78bfa", soft: "#f0eafa", darkSoft: "#302747" },
  blue: { light: "#2563eb", dark: "#60a5fa", soft: "#eaf2ff", darkSoft: "#1e334e" },
  green: { light: "#15803d", dark: "#4ade80", soft: "#e9f8ee", darkSoft: "#1d3a2b" },
  orange: { light: "#c2410c", dark: "#fb923c", soft: "#fff1e8", darkSoft: "#432b20" },
};

const AppearanceContext = createContext(null);

export function MobileAppearanceProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferences] = useState(DEFAULTS);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!active || !value) return;
        const saved = JSON.parse(value);
        setPreferences({
          mode: ["light", "dark", "system"].includes(saved?.mode)
            ? saved.mode
            : DEFAULTS.mode,
          accent: Object.prototype.hasOwnProperty.call(accents, saved?.accent)
            ? saved.accent
            : DEFAULTS.accent,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const updatePreferences = useCallback((changes) => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, [preferences]);

  const value = useMemo(() => {
    const isDark = preferences.mode === "dark" ||
      (preferences.mode === "system" && systemScheme === "dark");
    const accent = accents[preferences.accent] || accents.violet;
    const colors = isDark
      ? {
          background: "#0d1120",
          surface: "#161b2c",
          elevated: "#1c2236",
          soft: "#22283d",
          text: "#f4f5fa",
          muted: "#a1abc0",
          border: "#2b3249",
          accent: accent.dark,
          accentSoft: accent.darkSoft,
          danger: "#fb7185",
          dangerSoft: "#3b202b",
          success: "#4ade80",
          successSoft: "#173a2c",
          warning: "#fbbf24",
        }
      : {
          background: "#f8f7fc",
          surface: "#ffffff",
          elevated: "#ffffff",
          soft: "#f5f3fa",
          text: "#17203c",
          muted: "#71798c",
          border: "#e7e2ee",
          accent: accent.light,
          accentSoft: accent.soft,
          danger: "#be123c",
          dangerSoft: "#fff1f2",
          success: "#15803d",
          successSoft: "#e9f6ee",
          warning: "#b45309",
        };

    const theme = { isDark, colors };
    return { ...preferences, ...theme, theme, updatePreferences };
  }, [preferences, systemScheme, updatePreferences]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useMobileAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useMobileAppearance must be used inside MobileAppearanceProvider.");
  return value;
}
