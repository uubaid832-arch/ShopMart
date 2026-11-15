const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

export async function translateBatchToUrdu(texts) {
  const values = [...new Set(texts.map((value) => String(value ?? "").trim()).filter(Boolean))];
  if (!values.length) return [];
  if (values.length > 50 || values.reduce((sum, value) => sum + value.length, 0) > 4000) {
    throw new Error("Translate a smaller batch of text at a time.");
  }
  if (!baseUrl) throw new Error("Set EXPO_PUBLIC_API_URL in the mobile .env file.");

  const response = await fetch(`${baseUrl}/api/mobile/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: values }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Could not translate ShopMart right now.");
  }
  if (!Array.isArray(data.translatedTexts) || data.translatedTexts.length !== values.length) {
    throw new Error("The translation service returned an unexpected response.");
  }
  return data.translatedTexts;
}
