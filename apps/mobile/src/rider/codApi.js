const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
export async function codRequest(token, path, values, signal) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");
  const response = await fetch(`${baseUrl}/api/mobile/rider${path}`, {
    method: values ? "POST" : "GET", credentials: "omit", signal,
    headers: { Authorization: `Bearer ${token}`, ...(values && { "Content-Type": "application/json" }) },
    body: values ? JSON.stringify(values) : undefined,
  });
  if (!response.ok) {
    const error = new Error(({400:"Check the selected collections and note.",401:"Please sign out and sign in again.",403:"Rider access is required.",404:"This record is no longer available.",409:"A collection was already reported or this request changed. Refresh your balance."})[response.status] || "Could not confirm the request. Refresh before trying again.");
    error.status=response.status; throw error;
  }
  return response.json();
}
export const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 2 }).format(Number(value || 0));
