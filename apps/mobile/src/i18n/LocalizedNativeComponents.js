import { forwardRef, useEffect, useState } from "react";
import { Text as NativeText, TextInput as NativeTextInput } from "react-native";
import { useMobileLanguage } from "./MobileLanguage";

function plainText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(plainText);
    return parts.every((part) => part !== null) ? parts.join("") : null;
  }
  return value == null ? "" : null;
}

function useLocalizedString(value) {
  const { language, translateText } = useMobileLanguage();
  const [result, setResult] = useState({ source: null, translated: "" });
  const source = typeof value === "string" ? value : null;

  useEffect(() => {
    if (language !== "ur" || !source || !/[A-Za-z]/.test(source) || /[\u0590-\u08ff]/.test(source)) return undefined;
    let active = true;
    translateText(source).then((translated) => {
      if (active) setResult({ source, translated: String(translated ?? source) });
    });
    return () => { active = false; };
  }, [language, source, translateText]);

  return language === "ur" && result.source === source && result.translated
    ? result.translated
    : value;
}

export const Text = forwardRef(function LocalizedText({ children, style, ...props }, ref) {
  const { language } = useMobileLanguage();
  const source = plainText(children);
  const translated = useLocalizedString(source);
  const accessibilityLabel = useLocalizedString(props.accessibilityLabel);
  const output = language === "ur" && source !== null ? translated : children;
  const localizedStyle = language === "ur" && source !== null
    ? [style, { writingDirection: "rtl" }]
    : style;

  return (
    <NativeText
      {...props}
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      style={localizedStyle}
    >
      {output}
    </NativeText>
  );
});

export const TextInput = forwardRef(function LocalizedTextInput(props, ref) {
  const { language } = useMobileLanguage();
  const placeholder = useLocalizedString(props.placeholder);
  const accessibilityLabel = useLocalizedString(props.accessibilityLabel);
  return (
    <NativeTextInput
      {...props}
      ref={ref}
      placeholder={language === "ur" ? placeholder : props.placeholder}
      accessibilityLabel={accessibilityLabel}
      writingDirection={language === "ur" ? "rtl" : "ltr"}
    />
  );
});
