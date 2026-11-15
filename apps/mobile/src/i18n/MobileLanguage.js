import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import urduTranslations from "./urduTranslations.json";

const LANGUAGE_KEY = "shopmart-mobile-language-v1";
const MobileLanguageContext = createContext(null);
const urduLookup = new Map(
  Object.entries(urduTranslations).map(([source, translation]) => [
    source.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
    translation,
  ]),
);

function translateTextToUrdu(value) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || /[\u0590-\u08ff]/.test(normalized)) return value;
  return urduLookup.get(normalized.toLocaleLowerCase()) ?? value;
}

export function MobileLanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => {
        if (active && (saved === "en" || saved === "ur")) setLanguageState(saved);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const setLanguage = useCallback((value) => {
    if (value !== "en" && value !== "ur") return;
    setLanguageState(value);
    AsyncStorage.setItem(LANGUAGE_KEY, value).catch(() => {});
  }, []);

  const translateText = useCallback(translateTextToUrdu, []);

  const value = { language, setLanguage, translateText, direction: language === "ur" ? "rtl" : "ltr" };
  return <MobileLanguageContext.Provider value={value}>{children}</MobileLanguageContext.Provider>;
}

export function useMobileLanguage() {
  const context = useContext(MobileLanguageContext);
  if (!context) throw new Error("useMobileLanguage requires MobileLanguageProvider.");
  return context;
}
