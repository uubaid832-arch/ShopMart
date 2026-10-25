import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
const listeners = new Map();
export function notificationReadChanged(userId) {
  for (const listener of listeners.get(userId) || []) listener();
}

export default function NotificationBell({ session, onPress, style }) {
  const [result, setResult] = useState(null);
  const userId = session?.user.id;
  const token = session?.accessToken;
  useEffect(() => {
    if (!userId || !token || !baseUrl) return;
    let mounted = true;
    let timer;
    let controller;
    let pending = false;
    let again = false;
    async function load() {
      if (!mounted || AppState.currentState !== "active") return;
      if (pending) {
        again = true;
        return;
      }
      pending = true;
      clearTimeout(timer);
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(
          `${baseUrl}/api/mobile/notifications?page=0&size=1`,
          {
            credentials: "omit",
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          if (
            mounted &&
            Number.isSafeInteger(data.unreadCount) &&
            data.unreadCount >= 0
          )
            setResult({ userId, token, count: data.unreadCount });
        } else if (mounted && [401, 403].includes(response.status))
          setResult({ userId, token, count: 0 });
      } catch {
        /* A temporary connection failure must not invent unread messages. */
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (mounted && AppState.currentState === "active") {
          const delay = again ? 0 : 15000;
          again = false;
          timer = setTimeout(load, delay);
        }
      }
    }
    let callbacks = listeners.get(userId);
    if (!callbacks) {
      callbacks = new Set();
      listeners.set(userId, callbacks);
    }
    callbacks.add(load);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
      else {
        clearTimeout(timer);
        controller?.abort();
      }
    });
    load();
    return () => {
      mounted = false;
      clearTimeout(timer);
      controller?.abort();
      subscription.remove();
      callbacks.delete(load);
      if (!callbacks.size) listeners.delete(userId);
    };
  }, [userId, token]);
  const count =
    result?.userId === userId && result?.token === token ? result.count : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        count ? `Notifications, ${count} unread` : "Notifications"
      }
      onPress={onPress}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
          stroke="#7c3aed"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {count > 0 && (
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.count}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f0eafa",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: "#e44d76",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  count: { fontSize: 9, fontWeight: "800", color: "#fff" },
  pressed: { opacity: 0.6 },
});
