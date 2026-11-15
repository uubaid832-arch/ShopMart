import { useEffect, useState } from "react";
import { LanguageContext } from "./useLanguage";
import { translateTextToUrdu } from "../../api/translation";

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
    const attributeNames = ["placeholder", "title", "aria-label", "alt"];

    function visitText(node) {
      const current = node.data;
      const previous = translatedText.get(node);
      if (previous?.translated === current) return;
      const translation = translateTextToUrdu(current);
      if (!translation || translation === current.trim()) return;
      const prefix = current.match(/^\s*/)?.[0] ?? "";
      const suffix = current.match(/\s*$/)?.[0] ?? "";
      node.data = `${prefix}${translation}${suffix}`;
      translatedText.set(node, { original: current, translated: node.data });
    }

    function visitElement(element) {
      if (!(element instanceof Element)) return;
      if (element.matches("script,style,noscript,code,pre,svg,textarea")) return;
      for (const name of attributeNames) {
        const current = element.getAttribute(name);
        if (current === null) continue;
        const previous = translatedAttributes.get(element)?.get(name);
        if (previous?.translated === current) continue;
        const translation = translateTextToUrdu(current);
        if (!translation || translation === current.trim()) continue;
        element.setAttribute(name, translation);
        const values = translatedAttributes.get(element) ?? new Map();
        values.set(name, { original: current, translated: translation });
        translatedAttributes.set(element, values);
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
      observer.disconnect();
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
      if (event.key === storageKey || event.key === null) setLanguageState(readLanguage());
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
    <LanguageContext.Provider value={{ language, setLanguage, t, direction: language === "ur" ? "rtl" : "ltr" }}>
      {children}
    </LanguageContext.Provider>
  );
}
