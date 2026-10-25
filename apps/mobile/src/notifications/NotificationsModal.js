import { useEffect, useRef, useState } from "react";
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

export default function NotificationsModal({ session, onClose }) {
  const token = session.accessToken;
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const pending = useRef(false);

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

  async function markRead(id) {
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
      setReload((value) => value + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.grow}>
            <Text style={styles.title}>Notifications</Text>
            {data && (
              <Text style={styles.muted}>{data.unreadCount} unread</Text>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.button}
          >
            <Text style={styles.link}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !current}
            onPress={() => {
              setActionError("");
              setReload((value) => value + 1);
            }}
            style={styles.button}
          >
            <Text style={styles.link}>Refresh</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy || !data || data.unreadCount === 0}
            onPress={() => markRead()}
            style={styles.button}
          >
            <Text style={styles.link}>
              {busy ? "Updating..." : "Mark all read"}
            </Text>
          </Pressable>
        </View>

        {actionError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {actionError}
          </Text>
        ) : null}

        {!current ? (
          <ActivityIndicator
            size="large"
            color="#7c3aed"
            style={styles.loader}
          />
        ) : result.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {result.error}
          </Text>
        ) : (
          <>
            <FlatList
              data={data.items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No notifications yet.</Text>
              }
              renderItem={({ item }) => (
                <View style={[styles.card, !item.readAt && styles.unread]}>
                  <Text style={styles.cardTitle}>
                    {!item.readAt ? "● " : ""}
                    {item.title}
                  </Text>

                  <Text style={styles.message}>{item.message}</Text>

                  <Text style={styles.muted}>
                    {new Date(item.createdAt).toLocaleString("en-PK")}
                  </Text>

                  {!item.readAt && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => markRead(item.id)}
                      style={styles.readButton}
                    >
                      <Text style={styles.link}>Mark as read</Text>
                    </Pressable>
                  )}
                </View>
              )}
            />

            {data.totalPages > 1 && (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || page === 0}
                  onPress={() => setPage((value) => value - 1)}
                  style={styles.button}
                >
                  <Text style={styles.link}>Previous</Text>
                </Pressable>

                <Text style={styles.muted}>
                  {page + 1} / {data.totalPages}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={busy || page + 1 >= data.totalPages}
                  onPress={() => setPage((value) => value + 1)}
                  style={styles.button}
                >
                  <Text style={styles.link}>Next</Text>
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
