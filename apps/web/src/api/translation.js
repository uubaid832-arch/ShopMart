import bundledTranslations from "../i18n/urduTranslations.json";

const urduLookup = new Map(
  Object.entries(bundledTranslations).map(([source, translation]) => [
    source.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
    translation,
  ]),
);

/** Translate known ShopMart UI copy from a local dictionary. No network request is made. */
export function translateTextToUrdu(value) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || /[\u0590-\u08ff]/.test(normalized)) return value;
  return urduLookup.get(normalized.toLocaleLowerCase()) ?? value;
}

export async function translateBatchToUrdu(texts) {
  return texts.map((text) => translateTextToUrdu(text));
}
