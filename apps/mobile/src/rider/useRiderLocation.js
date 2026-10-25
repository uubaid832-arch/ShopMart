import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
export function useRiderLocation(session) {
  const tokenRef = useRef(session.accessToken);
  tokenRef.current = session.accessToken;
  const active = useRef(null);
  const version = useRef(0);
  const timer = useRef(null);
  const mounted = useRef(true);
  const inFlight = useRef(Promise.resolve());
  const starting = useRef(false);
  const [orderId, setOrderId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function send(id, method, values) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${baseUrl}/api/mobile/rider/deliveries/${encodeURIComponent(id)}/location`, {
        method, credentials: "omit", signal: controller.signal,
        headers: { Authorization: `Bearer ${tokenRef.current}`, ...(values && { "Content-Type": "application/json" }) },
        body: values ? JSON.stringify(values) : undefined,
      });
      if (!response.ok) {
        const error = new Error(response.status === 409 ? "Sharing is unavailable at this delivery stage." : response.status === 401 ? "Please sign in again." : "Location update failed. Check your connection.");
        error.status = response.status; throw error;
      }
    } finally { clearTimeout(timeout); }
  }

  function enqueue(action) {
    const job = inFlight.current.then(action);
    inFlight.current = job.catch(() => {});
    return job;
  }

  async function stop(showMessage = true) {
    const id = active.current;
    version.current += 1;
    active.current = null;
    clearTimeout(timer.current);
    if (mounted.current) { setOrderId(null); if (showMessage) setMessage("Location sharing stopped."); }
    if (id) {
      try { await enqueue(() => send(id, "DELETE")); }
      catch { if (mounted.current) setMessage("Sharing stopped on this phone. The last server position may remain visible for up to two minutes."); }
    }
  }

  async function start(delivery) {
    if (starting.current || delivery.status !== "DISPATCHED") return;
    starting.current = true; setBusy(true); setMessage("");
    // Capture a generation so leaving the app during the permission prompt cancels startup.
    const initialVersion = version.current;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("Allow location access to share your delivery position.");
      if (!(await Location.hasServicesEnabledAsync())) throw new Error("Turn on your phone's location services first.");
      if (!mounted.current || AppState.currentState !== "active" || version.current !== initialVersion) return;
      await stop(false);
      if (!mounted.current || AppState.currentState !== "active") return;
      active.current = delivery.id;
      const stamp = ++version.current;
      setOrderId(delivery.id);
      setMessage("Getting a fresh GPS position...");
      async function tick() {
        if (!mounted.current || version.current !== stamp || AppState.currentState !== "active") return;
        let terminal = false;
        try {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!mounted.current || version.current !== stamp || AppState.currentState !== "active") return;
          const { latitude, longitude, accuracy } = position.coords;
          if (!Number.isFinite(accuracy) || accuracy < 0 || Date.now() - position.timestamp > 60000) throw new Error("Waiting for a fresh, valid GPS reading.");
          await enqueue(async () => {
            if (version.current === stamp) await send(delivery.id, "PUT", { latitude, longitude, accuracy });
          });
          if (mounted.current && version.current === stamp) setMessage(`Location sent at ${new Date().toLocaleTimeString("en-PK")}. Accuracy about ${Math.round(accuracy)} m.`);
        } catch (error) {
          if ([401, 403, 404, 409].includes(error.status)) { terminal = true; await stop(false); }
          if (mounted.current && (version.current === stamp || terminal)) setMessage(error.message || "Could not get your location. Retrying.");
        } finally {
          if (!terminal && mounted.current && version.current === stamp && AppState.currentState === "active") timer.current = setTimeout(tick, 15000);
        }
      }
      tick();
    } catch (error) { if (mounted.current) setMessage(error.message || "Could not start location sharing."); }
    finally { starting.current = false; if (mounted.current) setBusy(false); }
  }

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        starting.current = false;
        stop(false);
        if (mounted.current) setMessage("Sharing stopped because ShopMart left the foreground. Start it again when ready.");
      }
    });
    return () => { mounted.current = false; subscription.remove(); stop(false); };
  }, []);

  return { orderId, busy, message, start, stop };
}
