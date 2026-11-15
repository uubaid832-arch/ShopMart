import urduTranslations from "../i18n/urduTranslations.json";

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

// Kept for callers that translate groups of labels. This only reads bundled text.
export async function translateBatchToUrdu(texts) {
  return texts.map(translateTextToUrdu);
}
