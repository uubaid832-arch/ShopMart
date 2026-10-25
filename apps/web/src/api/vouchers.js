export async function voucherRequest(
  token,
  path,
  { method = "GET", values, signal } = {},
) {
  const headers = { Authorization: `Bearer ${token}` };
  if (values) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const response = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("Could not prepare the secure request.");
    const csrf = await response.json();
    headers[csrf.headerName] = csrf.token;
  }
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values ? JSON.stringify(values) : undefined,
  });
  if (response.status === 204) return null;
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* Status fallback below. */
  }
  if (!response.ok) {
    const error = new Error(
      data?.message ||
        {
          400: "Check the voucher settings.",
          401: "Sign in again.",
          403: "Administrator access is required.",
          409: "The voucher changed or is unavailable. Refresh and try again.",
        }[response.status] ||
        "Could not confirm the result. Check the list before retrying.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
