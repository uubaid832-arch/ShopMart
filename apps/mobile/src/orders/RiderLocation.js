import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RiderMap from "./RiderMap";
const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export default function RiderLocation({ session, order }) {
  const token = session.accessToken;
  const orderId = order.id;
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let active = true;
    let running = false;
    let timer;
    let controller;

    async function refresh() {
      if (!active || running || AppState.currentState !== "active") return;

      clearTimeout(timer);
      running = true;
      controller = new AbortController();
      const currentController = controller;
      const timeout = setTimeout(() => currentController.abort(), 20000);

      try {
        const response = await fetch(
          `${baseUrl}/api/mobile/orders/${encodeURIComponent(orderId)}/location`,
          {
            credentials: "omit",
            headers: { Authorization: `Bearer ${token}` },
            signal: currentController.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Your session expired. Please sign in again."
              : "Could not retrieve the rider location.",
          );
        }

        const data = await response.json();

        if (
          typeof data.available !== "boolean" ||
          (data.available &&
            (!Number.isFinite(data.latitude) ||
              Math.abs(data.latitude) > 90 ||
              !Number.isFinite(data.longitude) ||
              Math.abs(data.longitude) > 180 ||
              !Number.isFinite(data.accuracy) ||
              data.accuracy < 0 ||
              !Number.isFinite(Date.parse(data.updatedAt))))
        ) {
          throw new Error("Invalid location information received.");
        }

        if (active) {
          setResult({ token, orderId, data, error: "" });
          setNow(Date.now());
        }
      } catch (failure) {
        if (active && AppState.currentState === "active") {
          setResult({
            token,
            orderId,
            data: null,
            error:
              failure.name === "AbortError"
                ? "Location request timed out. Retrying automatically."
                : failure.message,
          });
        }
      } finally {
        clearTimeout(timeout);
        running = false;

        if (active && AppState.currentState === "active") {
          timer = setTimeout(refresh, 15000);
        }
      }
    }

    refresh();

    const clock = setInterval(() => setNow(Date.now()), 5000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      } else {
        clearTimeout(timer);
        controller?.abort();
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(clock);
      controller?.abort();
      subscription.remove();
    };
  }, [token, orderId]);

  const current = result?.token === token && result?.orderId === orderId;
  const data = current ? result.data : null;
  const updated = Date.parse(data?.updatedAt || "");
  const age = now - updated;

  const available =
    data?.available === true &&
    Number.isFinite(updated) &&
    age >= -30000 &&
    age < 120000;

  const stale =
    data?.state === "STALE" || (data?.available === true && !available);

  const destination = [
    order.delivery?.address,
    order.delivery?.city,
    "Pakistan",
  ]
    .filter(Boolean)
    .join(", ");

  async function openMaps(directions = false) {
    setMapError("");

    // Recheck freshness when the customer presses the button.
    const ageAtClick = Date.now() - updated;

    if (!available || ageAtClick >= 120000 || ageAtClick < -30000) {
      setMapError("Wait for a fresh rider location before opening Maps.");
      return;
    }

    const coordinates = `${data.latitude},${data.longitude}`;

    const url = directions
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(coordinates)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`;

    try {
      await Linking.openURL(url);
    } catch {
      setMapError("Could not open Google Maps on this device.");
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Rider location</Text>
        <View style={[styles.badge, !available && styles.offlineBadge]}>
          <Text style={[styles.badgeText, !available && styles.offlineText]}>
            {available ? "Recent update" : "Waiting"}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>
        Checks about every 15 seconds while this screen is open and the app is
        active.
      </Text>

      {!current ? (
        <ActivityIndicator color="#7c3aed" style={styles.loader} />
      ) : result.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {result.error}
        </Text>
      ) : available ? (
        <>
          <RiderMap
            latitude={data.latitude}
            longitude={data.longitude}
            accuracy={data.accuracy}
          />
          <Text style={styles.updated}>
            Last reported:{" "}
            {new Date(data.updatedAt).toLocaleTimeString("en-PK")}
          </Text>

          <Text style={styles.description}>
            GPS accuracy: approximately {Math.round(data.accuracy)} metres.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => openMaps()}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>Open rider in Google Maps</Text>
          </Pressable>

          {order.delivery?.address && order.delivery?.city && (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => openMaps(true)}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>
                  Route & Arival estimate
                </Text>
              </Pressable>

              <Text style={styles.note}>
                Google Maps calculates a suggested driving route from the
                rider's latest position to your address. Verify the destination
                pin. Its travel estimate is not a guaranteed delivery time.
              </Text>
            </>
          )}

          <Text style={styles.note}>
            Google Maps opens a snapshot. Return to ShopMart for updated rider
            coordinates.
          </Text>
        </>
      ) : (
        <Text style={styles.description}>
          {stale
            ? "The last location is over two minutes old. Waiting for a fresh update."
            : "Location appears when the assigned rider shares it for an out-for-delivery order."}
        </Text>
      )}

      {mapError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mapError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8e1f5",
    borderRadius: 20,
    marginTop: 22,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: "800", color: "#25304a" },
  badge: {
    backgroundColor: "#ecfdf5",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  badgeText: { color: "#15803d", fontWeight: "700", fontSize: 10 },
  offlineBadge: { backgroundColor: "#f1f5f9" },
  offlineText: { color: "#64748b" },
  description: {
    color: "#7c859b",
    fontSize: 12,
    lineHeight: 21,
    marginTop: 10,
  },
  updated: { color: "#334155", fontSize: 12, fontWeight: "600", marginTop: 15 },
  loader: { marginVertical: 18 },
  primary: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
    marginTop: 17,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 12,
  },
  secondary: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#ede9fe",
    marginTop: 10,
  },
  secondaryText: {
    color: "#6d28d9",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 12,
  },
  note: { color: "#9299ab", fontSize: 11, lineHeight: 19, marginTop: 12 },
  error: { color: "#be123c", fontSize: 12, lineHeight: 21, marginTop: 12 },
});
