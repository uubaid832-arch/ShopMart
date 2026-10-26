import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { adminRequest, dateLabel, readable } from "./adminApi";
import RiderLocation from "../orders/RiderLocation";

const messages = {
  PENDING: "Order placed and awaiting confirmation.",
  CONFIRMED: "Order confirmed and being prepared for delivery.",
  DISPATCHED: "Parcel dispatched with the assigned rider.",
  DELIVERED: "Delivery completed.",
  CANCELLED: "Order cancelled.",
  RETURNED: "Order returned.",
  RETURNED_TO_WAREHOUSE:
    "Rider reported returning the parcel to the warehouse.",
  WAREHOUSE_RECEIPT_CONFIRMED:
    "Administrator confirmed physical warehouse receipt.",
};
export default function AdminOrderTracking({ session, order, revision = 0 }) {
  const [result, setResult] = useState(null);
  const token = session.accessToken;
  const orderId = order.id;
  useEffect(() => {
    let active = true;
    let pending = false;
    let again = false;
    let timer;
    let controller;
    const foreground = () =>
      !["background", "inactive"].includes(AppState.currentState);
    async function load() {
      if (!active || !foreground()) return;
      if (pending) {
        again = true;
        return;
      }
      clearTimeout(timer);
      pending = true;
      controller = new AbortController();
      try {
        const events = await adminRequest(
          token,
          `/orders/${encodeURIComponent(orderId)}/history`,
          { signal: controller.signal },
        );
        if (!Array.isArray(events))
          throw new Error("Tracking updates could not be read.");
        if (active) setResult({ token, orderId, events, error: "" });
      } catch (error) {
        if (active && !controller.signal.aborted)
          setResult((previous) => ({
            token,
            orderId,
            events:
              previous?.token === token && previous?.orderId === orderId
                ? previous.events
                : [],
            error: error.message || "Unable to load tracking updates.",
          }));
      } finally {
        pending = false;
        if (active && foreground()) {
          timer = setTimeout(load, again ? 0 : 15000);
          again = false;
        }
      }
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
      else {
        clearTimeout(timer);
        controller?.abort();
      }
    });
    load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      subscription.remove();
    };
  }, [token, orderId, revision]);
  const current = result?.token === token && result?.orderId === orderId;
  const events = current ? result.events : [];
  const latest = [...events]
    .reverse()
    .find((event) =>
      [
        "PENDING",
        "CONFIRMED",
        "DISPATCHED",
        "DELIVERED",
        "CANCELLED",
        "RETURNED",
      ].includes(event.status),
    );
  const status = latest?.status || order.status;
  return (
    <View style={s.section}>
      {status === "DISPATCHED" && (
        <RiderLocation
          key={orderId}
          session={session}
          order={{ ...order, status }}
        />
      )}
      <View style={s.card}>
        <View style={s.heading}>
          <View style={s.grow}>
            <Text style={s.title}>Order tracking history</Text>
            <Text style={s.caption}>
              Delivery progress · refreshes every 15 seconds
            </Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeText}>{readable(status)}</Text>
          </View>
        </View>
        {!current ? (
          <ActivityIndicator color="#7c3aed" />
        ) : (
          <>
            {result.error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {result.error}
              </Text>
            ) : null}
            {!events.length && !result.error ? (
              <Text style={s.caption}>No tracking updates yet.</Text>
            ) : null}
            {events.map((event, index) => (
              <View key={`${event.createdAt}-${index}`} style={s.event}>
                <View style={s.rail}>
                  <View
                    style={[s.dot, index === events.length - 1 && s.latest]}
                  />
                  {index < events.length - 1 && <View style={s.line} />}
                </View>
                <View style={s.eventBody}>
                  <Text style={s.eventTitle}>{readable(event.status)}</Text>
                  <Text style={s.message}>
                    {messages[event.status] ||
                      (event.status.startsWith("DELIVERY_FAILED:")
                        ? "The delivery attempt was unsuccessful. Check the reported reason above."
                        : "Delivery status updated.")}
                  </Text>
                  <Text style={s.time}>
                    {dateLabel(event.createdAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 14 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e9e1f0",
    padding: 17,
    borderRadius: 19,
  },
  heading: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 19,
  },
  grow: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", color: "#39244e" },
  caption: { fontSize: 11, color: "#92819e", marginTop: 6, lineHeight: 17 },
  badge: {
    backgroundColor: "#f1eafa",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#7c3aed" },
  event: { flexDirection: "row", gap: 12 },
  rail: { width: 16, alignItems: "center" },
  dot: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: "#b995ec",
    marginTop: 4,
  },
  latest: {
    backgroundColor: "#7c3aed",
    borderWidth: 3,
    borderColor: "#dcccfa",
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: "#e9ddf6",
    marginTop: 4,
    marginBottom: 3,
  },
  eventBody: { flex: 1, paddingBottom: 21 },
  eventTitle: { fontSize: 13, fontWeight: "800", color: "#493358" },
  message: { fontSize: 12, lineHeight: 19, color: "#81708f", marginTop: 4 },
  time: { fontSize: 10, color: "#a191ac", marginTop: 5 },
  error: { fontSize: 12, color: "#bc3457", marginBottom: 12 },
});
