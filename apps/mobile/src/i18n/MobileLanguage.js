import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { translateBatchToUrdu } from "../api/translation";

const LANGUAGE_KEY = "shopmart-mobile-language-v1";
const MobileLanguageContext = createContext(null);

export function MobileLanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");
  const cacheRef = useRef(new Map());
  const pendingRef = useRef(new Map());
  const timerRef = useRef(null);

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

  const flushQueue = useCallback(async () => {
    timerRef.current = null;
    const entries = [...pendingRef.current.entries()];
    const batch = [];
    let total = 0;
    for (const [text] of entries) {
      if (batch.length >= 50 || total + text.length > 3500) break;
      batch.push(text);
      total += text.length;
    }
    if (!batch.length && entries.length) batch.push(entries[0][0]);
    const resolvers = new Map(batch.map((text) => [text, pendingRef.current.get(text)]));
    batch.forEach((text) => pendingRef.current.delete(text));

    try {
      const translations = await translateBatchToUrdu(batch);
      batch.forEach((text, index) => {
        const translated = translations[index] || text;
        cacheRef.current.set(text, translated);
        resolvers.get(text)?.forEach((resolveValue) => resolveValue(translated));
      });
    } catch {
      batch.forEach((text) => resolvers.get(text)?.forEach((resolveValue) => resolveValue(text)));
    }

    if (pendingRef.current.size && !timerRef.current) {
      timerRef.current = setTimeout(flushQueue, 45);
    }
  }, []);

  const translateText = useCallback((value) => {
    const source = String(value ?? "").trim();
    if (!source || !/[A-Za-z]/.test(source) || /[\u0590-\u08ff]/.test(source)) {
      return Promise.resolve(value);
    }
    if (cacheRef.current.has(source)) return Promise.resolve(cacheRef.current.get(source));

    return new Promise((resolve) => {
      const existing = pendingRef.current.get(source);
      if (existing) existing.push(resolve);
      else pendingRef.current.set(source, [resolve]);

      if (!timerRef.current) {
        timerRef.current = setTimeout(flushQueue, 45);
      }
    });
  }, [flushQueue]);

  const value = { language, setLanguage, translateText, direction: language === "ur" ? "rtl" : "ltr" };
  return <MobileLanguageContext.Provider value={value}>{children}</MobileLanguageContext.Provider>;
}

export function useMobileLanguage() {
  const context = useContext(MobileLanguageContext);
  if (!context) throw new Error("useMobileLanguage requires MobileLanguageProvider.");
  return context;
}
