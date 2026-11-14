export async function getWarehouseReturnAddress(token, signal) {
  const response = await fetch("/api/admin/settings/warehouse-address", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `Could not load the saved warehouse return address (HTTP ${response.status}). Check the deployed backend endpoint and migration 021.`,
    );
  }
  const result = await response.json();
  return result.address || "";
}
