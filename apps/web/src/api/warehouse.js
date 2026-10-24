async function warehouseRequest(
  token,
  role,
  orderId,
  action = "",
  values,
  signal,
) {
  const headers = { Authorization: `Bearer ${token}` };
  let method = "GET";
  if (values !== undefined) {
    method = action === "resolution" ? "POST" : "PATCH";
    const prepared = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (!prepared.ok) throw new Error("Could not prepare the secure request.");
    const csrf = await prepared.json();
    if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
      throw new Error("Unexpected security response.");
    }
    headers[csrf.headerName] = csrf.token;
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(
    `/api/${role}/deliveries/${encodeURIComponent(orderId)}/${action || "warehouse"}`,
    {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers,
      signal,
      body: values === undefined ? undefined : JSON.stringify(values),
    },
  );
  if (!response.ok) {
    const messages = {
      400: "Check the selected rider and delivery attempt.",
      401: "Please sign in again.",
      403: "You do not have permission for this action.",
      404: "This delivery is no longer available to you.",
      409: "The delivery has changed or this action is unavailable. Refresh its return status.",
    };
    throw new Error(
      messages[response.status] ??
        "Could not update the warehouse return. Please try again.",
    );
  }
  return response.status === 204 ? null : response.json();
}

export const getWarehouseState = (token, role, id, signal) =>
  warehouseRequest(token, role, id, "", undefined, signal);

export const reportWarehouseReturn = (token, id, attemptId) =>
  warehouseRequest(token, "rider", id, "warehouse-return", { attemptId });

export const confirmWarehouseReceipt = (token, id, attemptId) =>
  warehouseRequest(token, "admin", id, "warehouse-receipt", { attemptId });

export const resolveWarehouseReturn = (token, id, values) =>
  warehouseRequest(token, "admin", id, "resolution", values);
