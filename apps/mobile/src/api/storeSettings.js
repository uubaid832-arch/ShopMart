const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

export async function getMobileStoreSettings(signal) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");
  const response = await fetch(`${baseUrl}/api/mobile/store/settings`, {
    credentials: "omit",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Could not load ShopMart delivery and payment settings (HTTP ${response.status}).`);
  return response.json();
}
