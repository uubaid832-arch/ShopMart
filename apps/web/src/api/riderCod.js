export async function riderCodRequest(token, path, { values, signal } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (values) {
    const prepared = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (!prepared.ok) throw new Error("Could not prepare the secure request.");
    const csrf = await prepared.json();
    headers[csrf.headerName] = csrf.token;
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`/api/rider${path}`, {
    method: values ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: values ? JSON.stringify(values) : undefined,
  });
  if (!response.ok)
    throw new Error(
      {
        401: "Sign in again.",
        403: "Rider access required.",
        409: "This cash may already be reported. Refresh handover history before retrying.",
      }[response.status] ||
        "Could not confirm this request. Refresh before retrying.",
    );
  return response.json();
}
