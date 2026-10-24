export async function getAdminDashboard(accessToken, signal) {
  const response = await fetch("/api/admin/dashboard", {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!response.ok) {
    const messages = {
      401: "Your session has expired. Please sign in again.",
      403: "Administrator access is required.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not load the dashboard. Please try again.",
    );
  }

  return response.json();
}
