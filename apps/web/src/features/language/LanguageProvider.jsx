import { useEffect, useState } from "react";
import { LanguageContext } from "./useLanguage";
import { translateBatchToUrdu } from "../../api/translation";

const storageKey = "shopmart-language";

const translations = {
  en: {
    search: "Search products",
    searchPlaceholder: "Search products...",
    wishlist: "Wishlist",
    cart: "Cart",
    profile: "My Profile",
    orders: "My Orders",
    tracking: "Track Order",
    returns: "Returns & Refunds",
    login: "Login / Register",
    signOut: "Sign out",
    about: "About Us",
    account: "Your account",
    accountOptions: "Account and orders",
    navigation: "Main navigation",
    home: "ShopMart home",
    items: "items",
    language: "Language",
  },
  ur: {
    search: "مصنوعات تلاش کریں",
    searchPlaceholder: "مصنوعات تلاش کریں...",
    wishlist: "پسندیدہ مصنوعات",
    cart: "خریداری کی ٹوکری",
    profile: "میری پروفائل",
    orders: "میرے آرڈرز",
    tracking: "آرڈر کی صورتحال",
    returns: "واپسی اور رقم کی واپسی",
    login: "لاگ اِن / رجسٹر",
    signOut: "سائن آؤٹ",
    about: "ہمارے بارے میں",
    account: "آپ کا اکاؤنٹ",
    accountOptions: "اکاؤنٹ اور آرڈرز",
    navigation: "مرکزی نیویگیشن",
    home: "شاپ مارٹ ہوم",
    items: "اشیاء",
    language: "زبان",
  },
};

function readLanguage() {
  try {
    return localStorage.getItem(storageKey) === "ur" ? "ur" : "en";
  } catch {
    return "en";
  }
}

export default function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    if (language !== "ur" || !document.body) return undefined;

    const translatedText = new Map();
    const translatedAttributes = new Map();
    const translationCache = new Map();
    const attributeNames = ["placeholder", "title", "aria-label", "alt"];
    const pending = new Map();
    let timer = null;
    let stopped = false;

    function textNeedsTranslation(value) {
      return typeof value === "string" && /[A-Za-z]/.test(value) && !/[\u0590-\u08ff]/.test(value);
    }

    function rememberCandidate(source, apply) {
      if (!textNeedsTranslation(source)) return;
      const original = source;
      const key = original.trim();
      if (!key) return;
      const cached = translationCache.get(key);
      if (cached) {
        apply(original, cached);
        return;
      }
      const callbacks = pending.get(key) ?? [];
      callbacks.push((translation) => apply(original, translation));
      pending.set(key, callbacks);
      if (!timer) timer = window.setTimeout(flush, 40);
    }

    async function flush() {
      timer = null;
      if (stopped || !pending.size) return;
      const batch = [];
      let total = 0;
      for (const key of pending.keys()) {
        if (batch.length >= 50 || total + key.length > 3500) break;
        batch.push(key);
        total += key.length;
      }
      if (!batch.length) return;
      const callbacks = new Map(batch.map((key) => [key, pending.get(key)]));
      batch.forEach((key) => pending.delete(key));
      try {
        const results = await translateBatchToUrdu(batch);
        if (stopped) return;
        batch.forEach((key, index) => {
          const translation = results[index] || key;
          translationCache.set(key, translation);
          callbacks.get(key)?.forEach((apply) => apply(translation));
        });
      } catch {
        // Keep the current English text visible if the translation service is unavailable.
      }
      if (pending.size && !timer && !stopped) timer = window.setTimeout(flush, 40);
    }

    function visitText(node) {
      const current = node.data;
      const previous = translatedText.get(node);
      if (previous?.translated === current) return;
      if (!textNeedsTranslation(current)) return;
      rememberCandidate(current, (original, translation) => {
        if (!node.isConnected || node.data !== original) return;
        node.data = translation;
        translatedText.set(node, { original, translated: translation });
      });
    }

    function visitElement(element) {
      if (!(element instanceof Element)) return;
      if (element.matches("script,style,noscript,code,pre,svg,textarea")) return;
      for (const name of attributeNames) {
        const current = element.getAttribute(name);
        if (current === null) continue;
        const previous = translatedAttributes.get(element)?.get(name);
        if (previous?.translated === current) continue;
        rememberCandidate(current, (original, translation) => {
          if (!element.isConnected || element.getAttribute(name) !== original) return;
          element.setAttribute(name, translation);
          const values = translatedAttributes.get(element) ?? new Map();
          values.set(name, { original, translated: translation });
          translatedAttributes.set(element, values);
        });
      }
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) visitText(child);
        else if (child.nodeType === Node.ELEMENT_NODE) visitElement(child);
      }
    }

    function scan(node) {
      if (node.nodeType === Node.TEXT_NODE) visitText(node);
      else if (node.nodeType === Node.ELEMENT_NODE) visitElement(node);
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") visitText(record.target);
        else if (record.type === "attributes") visitElement(record.target);
        else record.addedNodes.forEach(scan);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: attributeNames,
    });
    scan(document.body);

    return () => {
      stopped = true;
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
      for (const [node, record] of translatedText) {
        if (node.isConnected && node.data === record.translated) node.data = record.original;
      }
      for (const [element, records] of translatedAttributes) {
        if (!element.isConnected) continue;
        for (const [name, record] of records) {
          if (element.getAttribute(name) === record.translated) element.setAttribute(name, record.original);
        }
      }
    };
  }, [language]);

  useEffect(() => {
    function syncLanguage(event) {
      if (event.key === storageKey || event.key === null) {
        setLanguageState(readLanguage());
      }
    }

    window.addEventListener("storage", syncLanguage);
    return () => window.removeEventListener("storage", syncLanguage);
  }, []);

  function setLanguage(value) {
    if (!["en", "ur"].includes(value)) return;

    setLanguageState(value);

    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // The selection still works when browser storage is unavailable.
    }
  }

  function t(key) {
    return translations[language][key] ?? translations.en[key] ?? key;
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        direction: language === "ur" ? "rtl" : "ltr",
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
