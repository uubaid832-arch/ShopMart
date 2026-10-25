import { useEffect, useRef, useState } from "react";
const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
export function useVoucher(session, items) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const controller = useRef(null);
  const pending = useRef(false);
  const cartKey = JSON.stringify(
    items
      .map(({ id, quantity, price }) => ({ id, quantity, price }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
  );
  const userId = session?.user.id;
  const quote =
    result?.cartKey === cartKey && result?.userId === userId
      ? result.data
      : null;
  useEffect(
    () => () => {
      version.current++;
      controller.current?.abort();
    },
    [cartKey, userId],
  );
  function change(value) {
    version.current++;
    controller.current?.abort();
    setCode(value.toUpperCase());
    setResult(null);
    setError("");
  }
  function remove() {
    change("");
  }
  async function apply() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const stamp = ++version.current;
    controller.current = new AbortController();
    const signal = controller.current.signal;
    const timeout = setTimeout(() => controller.current?.abort(), 25000);
    try {
      if (!session?.accessToken)
        throw new Error("Sign in before applying a voucher.");
      const response = await fetch(`${baseUrl}/api/mobile/vouchers/quote`, {
        method: "POST",
        credentials: "omit",
        signal,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim(),
          items: items.map(({ id, quantity }) => ({ productId: id, quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message ||
            (response.status === 401
              ? "Sign in again."
              : "This voucher cannot be applied to this cart."),
        );
      if (stamp === version.current) setResult({ cartKey, userId, data });
    } catch (failure) {
      if (stamp === version.current) {
        setResult(null);
        setError(
          failure.name === "AbortError"
            ? "Could not check the voucher. Try again."
            : failure.message,
        );
      }
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      setBusy(false);
    }
  }
  return { code, change, remove, apply, busy, error, quote };
}
