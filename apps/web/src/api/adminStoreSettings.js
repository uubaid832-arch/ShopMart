export async function getWarehouseReturnAddress(token, signal) {
  const response = await fetch("/api/admin/settings/warehouse-address", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `Could not load the warehouse address (HTTP ${response.status}). Check the deployed backend and migration 021.`,
    );
  }
  const result = await response.json();
  return result.address || "";
}

export async function saveWarehouseReturnAddress(token, address) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!csrfResponse.ok) throw new Error("Could not prepare the secure request.");
  const csrf = await csrfResponse.json();
  const response = await fetch("/api/admin/settings/warehouse-address", {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ address: address.trim() }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? "Access denied. Sign in with an administrator account."
        : response.status === 400
          ? "Enter the full warehouse address, city, and contact details."
          : `Could not save the warehouse address (HTTP ${response.status}). Check the backend deployment and Neon migration 021.`,
    );
  }
  const result = await response.json();
  return result.address;
}

async function adminSettingsRequest(token, path, { method = "GET", values, signal } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (method !== "GET") {
    const csrfResponse = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store", signal });
    if (!csrfResponse.ok) throw new Error("Could not prepare the secure request.");
    const csrf = await csrfResponse.json();
    headers[csrf.headerName] = csrf.token;
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`/api/admin/settings/${path}`, {
    method, credentials: "same-origin", cache: "no-store", headers, signal,
    body: values ? JSON.stringify(values) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(
      detail?.message || detail?.detail || detail?.title ||
      `Could not ${method === "GET" ? "load" : "save"} store settings (HTTP ${response.status}).`,
    );
  }
  return response.json();
}

export const getAdminStoreProfile = (token, signal) =>
  adminSettingsRequest(token, "store-profile", { signal });

export const saveAdminStoreProfile = (token, values) =>
  adminSettingsRequest(token, "store-profile", { method: "PUT", values });

export async function getPublicStoreSettings(signal) {
  const response = await fetch("/api/store/settings", { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Could not load ShopMart delivery and payment settings (HTTP ${response.status}).`);
  return response.json();
}
