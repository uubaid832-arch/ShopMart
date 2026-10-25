import { useEffect, useRef, useState } from "react";
import { voucherRequest } from "../../api/vouchers";
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
  async function apply() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const stamp = ++version.current;
    controller.current = new AbortController();
    try {
      if (!session?.accessToken)
        throw new Error("Sign in before applying a voucher.");
      const data = await voucherRequest(
        session.accessToken,
        "/vouchers/quote",
        {
          method: "POST",
          signal: controller.current.signal,
          values: {
            code: code.trim(),
            items: items.map(({ id, quantity }) => ({
              productId: id,
              quantity,
            })),
          },
        },
      );
      if (stamp === version.current) setResult({ cartKey, userId, data });
    } catch (failure) {
      if (stamp === version.current) {
        setResult(null);
        setError(failure.message);
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { code, change, remove: () => change(""), apply, busy, error, quote };
}
