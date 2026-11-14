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
