import { useEffect, useState } from "react";
import { LanguageContext } from "./useLanguage";

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
