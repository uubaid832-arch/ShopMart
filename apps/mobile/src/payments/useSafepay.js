import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
const BASE =
  (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "") +
  "/api/mobile/checkout/safepay";
const SOURCE = "mobile";
const storage = AsyncStorage;
async function request(token, path, method = "GET", values, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort);
  const timer = setTimeout(abort, 45000);
  try {
    const headers = { Authorization: `Bearer ${token}` };

    if (values) headers["Content-Type"] = "application/json";
    const response = await fetch(BASE + path, {
      method,
      headers,
      credentials: "omit",
      signal: controller.signal,
      body: values ? JSON.stringify(values) : undefined,
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      /* Status fallback. */
    }
    if (!response.ok) {
      const error = new Error(
        data?.message ||
          `Payment request failed (HTTP ${response.status}). Check the same checkout before paying again.`,
      );
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError" && !signal?.aborted)
      throw new Error(
        "Payment confirmation timed out. Check the same checkout again; do not pay twice.",
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function sameCart(cartItems, orderItems) {
  const key = (list) =>
    [...list]
      .map((item) => `${item.id || item.productId}:${item.quantity}`)
      .sort()
      .join("|");
  return key(cartItems) === key(orderItems);
}
export function useSafepay(session, onPaid) {
  const key = `shopmart.safepay.sandbox.${BASE}.${session.user.id}`;
  const token = session.accessToken;
  const [model, setModel] = useState(null);
  const pending = useRef(false);
  const handled = useRef("");
  const generation = useRef(0);
  const current = model?.key === key;
  const data = current ? model.data : null;
  useEffect(() => {
    let active = true;
    generation.current += 1;
    const controller = new AbortController();
    (async () => {
      let id;
      try {
        id = await storage.getItem(key);
        if (id && !/^[a-f0-9-]{36}$/i.test(id)) id = null;
        let data = id
          ? await request(
              token,
              `/sessions/${id}`,
              "GET",
              undefined,
              controller.signal,
            )
          : await request(
              token,
              "/sessions/active",
              "GET",
              undefined,
              controller.signal,
            );
        if (!id && data?.id) {
          id = data.id;
          await storage.setItem(key, id);
        }
        if (active) setModel({ key, id, data, error: "", busy: false });
      } catch (error) {
        if (active)
          setModel({
            key,
            id,
            data: null,
            error: error.status === 404 ? "" : error.message,
            busy: false,
          });
      }
    })();
    return () => {
      active = false;
      generation.current += 1;
      controller.abort();
    };
  }, [key, token]);
  useEffect(() => {
    if (data?.state !== "PAID" || !data.order || handled.current === data.id)
      return;
    handled.current = data.id;
    storage.removeItem(key).catch(() => {});
    onPaid(data.order);
  }, [data, key, onPaid]);
  useEffect(() => {
    if (!data?.id || data.state !== "PENDING") return;
    let active = true;
    const controller = new AbortController();
    const poll = async () => {
      if (
        pending.current ||
        !!["background", "inactive"].includes(AppState.currentState)
      )
        return;
      pending.current = true;
      try {
        const value = await request(
          token,
          `/sessions/${data.id}/verify`,
          "POST",
          {},
          controller.signal,
        );
        if (active)
          setModel((previous) => ({
            ...previous,
            key,
            data: value,
            error: "",
            busy: false,
          }));
      } catch (error) {
        if (active && error.name !== "AbortError")
          setModel((previous) => ({ ...previous, key, error: error.message }));
      } finally {
        pending.current = false;
      }
    };
    const timer = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [data?.id, data?.state, key, token]);
  async function start(order) {
    if (pending.current || !current) return;
    const epoch = generation.current;
    pending.current = true;
    setModel((previous) => ({ ...previous, busy: true, error: "" }));
    let id = model.id || order.idempotencyKey;
    try {
      await storage.setItem(key, id);
      let value;
      if (model.id) {
        try {
          value = await request(token, `/sessions/${id}`, "GET");
        } catch (error) {
          if (error.status !== 404) throw error;
          value = await request(token, "/sessions/active");
          if (value?.id) {
            id = value.id;
            await storage.setItem(key, id);
          }
        }
      }
      if (!value)
        value = await request(token, "/sessions", "POST", {
          order: { ...order, idempotencyKey: id, paymentMethod: "DEMO" },
          source: SOURCE,
        });
      if (epoch !== generation.current) return;
      setModel({ key, id, data: value, error: "", busy: false });
    } catch (error) {
      if (epoch !== generation.current) return;
      // A definite validation rejection happens before a hosted checkout is exposed.
      // Let the customer correct their cart; uncertain network results keep the reference.
      if ([400, 409].includes(error.status) && !model.data) {
        await storage.removeItem(key).catch(() => {});
        id = null;
      }
      if (error.status === 429) {
        const active = await request(token, "/sessions/active").catch(
          () => null,
        );
        if (epoch !== generation.current) return;
        if (active?.id) {
          await storage.setItem(key, active.id).catch(() => {});
          setModel({
            key,
            id: active.id,
            data: active,
            error: "",
            busy: false,
          });
          return;
        }
      }
      if (epoch !== generation.current) return;
      setModel((previous) => ({
        ...previous,
        key,
        id,
        error: error.message,
        busy: false,
      }));
    } finally {
      pending.current = false;
    }
  }
  async function check() {
    if (pending.current || !model?.id) return;
    const epoch = generation.current;
    pending.current = true;
    setModel((previous) => ({ ...previous, busy: true, error: "" }));
    try {
      const value = await request(
        token,
        `/sessions/${model.id}/verify`,
        "POST",
        {},
      );
      if (epoch !== generation.current) return;
      setModel((previous) => ({
        ...previous,
        key,
        data: value,
        error: "",
        busy: false,
      }));
    } catch (error) {
      if (epoch !== generation.current) return;
      setModel((previous) => ({
        ...previous,
        key,
        error: error.message,
        busy: false,
      }));
    } finally {
      pending.current = false;
    }
  }
  async function resume() {
    if (pending.current || !model?.id) return null;
    const epoch = generation.current;
    pending.current = true;
    setModel((previous) => ({ ...previous, busy: true, error: "" }));
    try {
      const value = await request(
        token,
        `/sessions/${model.id}/resume`,
        "POST",
        {},
      );
      if (epoch !== generation.current) return;
      setModel((previous) => ({
        ...previous,
        key,
        data: value,
        error: "",
        busy: false,
      }));
      return value;
    } catch (error) {
      if (epoch !== generation.current) return;
      setModel((previous) => ({
        ...previous,
        key,
        error: error.message,
        busy: false,
      }));
      return null;
    } finally {
      pending.current = false;
    }
  }
  async function reset() {
    if (!data || !["CANCELLED", "REFUNDED"].includes(data.state)) return;
    await storage.removeItem(key);
    setModel({ key, id: null, data: null, error: "", busy: false });
  }
  return {
    ready: current,
    id: current ? model.id : null,
    data,
    busy: current && model.busy,
    error: current ? model.error : "",
    start,
    check,
    resume,
    reset,
  };
}
