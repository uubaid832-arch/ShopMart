import { useCallback, useEffect, useRef, useState } from "react";
import { notificationReadChanged } from "./NotificationBell";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMobileAppearance } from "../appearance/MobileAppearance";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

async function request(token, path, method = "GET", signal) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");

  const response = await fetch(`${baseUrl}/api/mobile/notifications${path}`, {
    method,
    credentials: "omit",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : "Could not update notifications. Please try again.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export default function NotificationsModal({ session, onClose, onOpenOrder }) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const token = session.accessToken;
  const isAdmin = session?.user?.role === "ADMIN";
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const pending = useRef(false);
  const autoReadStarted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    request(token, `?page=${page}&size=20`, "GET", controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ token, page, reload, data, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            page,
            reload,
            data: null,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, page, reload]);

  const current =
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload;

  const data = current ? result.data : null;

  const markRead = useCallback(async (id) => {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setActionError("");

    try {
      await request(
        token,
        id ? `/${encodeURIComponent(id)}/read` : "/read-all",
        "PATCH",
      );
      notificationReadChanged(session.user.id);
      setReload((value) => value + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [token, session.user.id]);

  useEffect(() => {
    if (!current || !data || data.unreadCount < 1 || autoReadStarted.current) return;
    autoReadStarted.current = true;
    void markRead();
  }, [current, data, isAdmin, markRead]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
          <View style={styles.grow}>
            <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
            {data && (
              <Text style={[styles.muted, { color: palette.muted }]}>{data.unreadCount} unread</Text>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.button, { backgroundColor: palette.accentSoft }]}
          >
            <Text style={[styles.link, { color: palette.accent }]}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !current}
            onPress={() => {
              setActionError("");
              autoReadStarted.current = false;
              setReload((value) => value + 1);
            }}
            style={[styles.button, { backgroundColor: palette.accentSoft }]}
          >
            <Text style={[styles.link, { color: palette.accent }]}>Refresh</Text>
          </Pressable>
          {isAdmin && data?.unreadCount > 0 && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => markRead()}
              style={[styles.button, { backgroundColor: palette.accentSoft }]}
            >
              <Text style={[styles.link, { color: palette.accent }]}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        {actionError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
            {actionError}
          </Text>
        ) : null}

        {!current ? (
          <ActivityIndicator
            size="large"
            color={palette.accent}
            style={styles.loader}
          />
        ) : result.error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
            {result.error}
          </Text>
        ) : (
          <>
            <FlatList
              data={data.items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: palette.muted }]}>No notifications yet.</Text>
              }
              renderItem={({ item }) => (
                <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, !item.readAt && { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    {!item.readAt ? "● " : ""}
                    {item.title}
                  </Text>

                  <Text style={[styles.message, { color: palette.muted }]}>{item.message}</Text>

                  <Text style={[styles.muted, { color: palette.muted }]}>
                    {new Date(item.createdAt).toLocaleString("en-PK")}
                  </Text>

                  {item.orderId && onOpenOrder && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open this order"
                      disabled={busy}
                      onPress={() => onOpenOrder(item.orderId)}
                      style={[styles.readButton, { backgroundColor: palette.accentSoft }]}
                    >
                      <Text style={[styles.link, { color: palette.accent }]}>Open order →</Text>
                    </Pressable>
                  )}
                  {isAdmin && !item.readAt && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => markRead(item.id)}
                      style={[styles.readButton, { backgroundColor: palette.accentSoft }]}
                    >
                      <Text style={[styles.link, { color: palette.accent }]}>Mark as read</Text>
                    </Pressable>
                  )}
                </View>
              )}
            />

            {data.totalPages > 1 && (
              <View style={[styles.pagination, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || page === 0}
                  onPress={() => setPage((value) => value - 1)}
                  style={[styles.button, { backgroundColor: palette.accentSoft }]}
                >
                  <Text style={[styles.link, { color: palette.accent }]}>Previous</Text>
                </Pressable>

                <Text style={[styles.muted, { color: palette.muted }]}>
                  {page + 1} / {data.totalPages}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={busy || page + 1 >= data.totalPages}
                  onPress={() => setPage((value) => value + 1)}
                  style={[styles.button, { backgroundColor: palette.accentSoft }]}
                >
                  <Text style={[styles.link, { color: palette.accent }]}>Next</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    backgroundColor: "#fff",
    gap: 12,
  },
  grow: { flex: 1 },
  title: { fontSize: 25, fontWeight: "800", color: "#0f172a" },
  muted: { color: "#64748b", fontSize: 12, marginTop: 8 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  button: {
    padding: 12,
    backgroundColor: "#ede9fe",
    borderRadius: 10,
  },
  link: { color: "#6d28d9", fontWeight: "700", fontSize: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  unread: { backgroundColor: "#f5f3ff", borderColor: "#c4b5fd" },
  cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "700" },
  message: { color: "#475569", lineHeight: 22, marginTop: 8 },
  readButton: { alignSelf: "flex-start", paddingVertical: 14 },
  error: { color: "#be123c", margin: 20, lineHeight: 22 },
  empty: { color: "#64748b", textAlign: "center", padding: 30 },
  loader: { marginTop: 40 },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
  },
});
