export async function getOrderAssignment(token, orderId, signal) {
  const response = await fetch(
    `/api/admin/deliveries/${encodeURIComponent(orderId)}/assignment`,
    {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );

  if (!response.ok) {
    const messages = {
      401: "Please sign in again.",
      403: "Administrator access is required.",
      404: "Order not found.",
    };
    throw new Error(
      messages[response.status] ?? "Could not load the rider assignment.",
    );
  }

  return response.json();
}
