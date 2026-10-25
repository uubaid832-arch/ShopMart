import { useEffect, useState } from "react";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
export async function adminRequest(
  token,
  path,
  { method = "GET", values, signal, formData } = {},
) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort);
  const timeout = setTimeout(abort, formData ? 90000 : 30000);
  try {
    const response = await fetch(`${baseUrl}/api/mobile/admin${path}`, {
      method,
      credentials: "omit",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(values && !formData ? { "Content-Type": "application/json" } : {}),
      },
      body: formData || (values ? JSON.stringify(values) : undefined),
    });
    if (!response.ok) {
      const error = new Error(
        {
          400: "Check the required fields and the selected action, then try again.",
          401: "Your session expired. Sign in again.",
          403: "This action is not allowed for this account or record.",
          404: "This record was not found. Check that the latest backend has deployed.",
          409: "This record changed, has linked records, or this action is unavailable at its current stage. Refresh before trying again.",
          413: "The selected photos are too large. Use JPEG or PNG images under 5 MB each.",
          429: "Too many requests. Please wait and try again.",
        }[response.status] ||
          "The server could not complete this request. Please try again.",
      );
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function useAdminResource(token, path, revision = 0) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    adminRequest(token, path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ token, path, revision, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            token,
            path,
            revision,
            data: null,
            error: error.message || "Connection unavailable. Try again.",
          });
      });
    return () => controller.abort();
  }, [token, path, revision]);
  const current =
    result?.token === token &&
    result?.path === path &&
    result?.revision === revision;
  return {
    loading: !current,
    data: current ? result.data : null,
    error: current ? result.error : "",
  };
}

export function money(value, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency }).format(
    Number(value || 0),
  );
}
export function readable(value = "") {
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export const apiBaseUrl = baseUrl;
export function imageUrl(value) {
  return !value
    ? null
    : /^https?:\/\//i.test(value)
      ? value
      : `${baseUrl}/${value.replace(/^\/+/, "")}`;
}
export async function loadCategories(signal) {
  const response = await fetch(`${baseUrl}/api/categories`, {
    credentials: "omit",
    signal,
  });
  if (!response.ok)
    throw new Error("Could not load categories. Refresh and try again.");
  return (await response.json()).items;
}
