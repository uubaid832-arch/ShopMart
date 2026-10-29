import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

const label = (value) => String(value === "APPROVED" ? "Accepted after inspection" : value === "RECEIVED" ? "Received - awaiting inspection" : value || "Not initiated").replace(/_/g, " ");

async function request(token, path, values, signal) {
  const response = await fetch(`${baseUrl}/api/mobile/returns${path}`, {
    method: values ? "POST" : "GET",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(values && { "Content-Type": "application/json" }),
    },
    body: values ? JSON.stringify(values) : undefined,
    signal,
  });

  if (!response.ok) {
    const messages = {
      400: "Select a purchased item and enter a reason of up to 1,000 characters.",
      401: "Your session expired. Please sign in again.",
      403: "Access denied.",
      404: "Purchased item not found.",
      409: "This item is no longer eligible or already has a return request.",
    };

    throw new Error(
      messages[response.status] ||
        "Could not confirm the request. Refresh before trying again.",
    );
  }

  return response.json();
}

export default function ReturnsModal({ session, onClose, orderId = null }) {
  const token = session.accessToken;
  const [tab, setTab] = useState("eligible");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const path = tab === "eligible" ? "/eligible" : "";
    const orderFilter = orderId ? `&orderId=${encodeURIComponent(orderId)}` : "";

    request(token, `${path}?page=${page}&size=10${orderFilter}`, undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ token, tab, page, reload, data, error: "" });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            tab,
            page,
            reload,
            data: null,
            error: failure.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, tab, page, reload, orderId]);

  const current =
    result?.token === token &&
    result?.tab === tab &&
    result?.page === page &&
    result?.reload === reload;

  const data = current ? result.data : null;

  function close() {
    if (!pending.current) onClose();
  }

  function changeTab(next) {
    if (pending.current) return;
    setTab(next);
    setPage(0);
    setSelected(null);
    setReason("");
    setError("");
  }

  async function submit() {
    if (pending.current || !current) return;

    const item = data?.items.find((entry) => entry.orderItemId === selected);

    if (!item || !reason.trim()) {
      setError("Select a product and explain why you want to return it.");
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await request(token, "", {
        orderId: item.orderId,
        orderItemId: item.orderItemId,
        reason: reason.trim(),
      });

      setSelected(null);
      setReason("");
      setTab("history");
      setPage(0);
      setReload((value) => value + 1);
      setNotice("Your return request has been submitted.");
    } catch (failure) {
      setError(failure.message);
      setSelected(null);
      setReload((value) => value + 1);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Returns & refunds</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={close}
              style={styles.button}
            >
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {[
              ["eligible", "Request return"],
              ["history", "Your requests"],
            ].map(([value, title]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === value }}
                disabled={busy}
                onPress={() => changeTab(value)}
                style={[styles.tab, tab === value && styles.activeTab]}
              >
                <Text style={tab === value ? styles.white : styles.link}>
                  {title}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              accessibilityRole="button"
              disabled={busy || !current}
              onPress={() => {
                setSelected(null);
                setReload((value) => value + 1);
              }}
              style={styles.refresh}
            >
              <Text style={styles.link}>Refresh</Text>
            </Pressable>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            {!current ? (
              <ActivityIndicator color="#7c3aed" />
            ) : result.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {result.error}
              </Text>
            ) : (
              <>
                {tab === "eligible" && (
                  <Text style={styles.description}>
                    Returns cover the full quantity of the selected purchased
                    item. Only delivered, paid COD or verified Safepay items without an existing
                    return request are eligible.
                  </Text>
                )}

                {data.items.length === 0 && (
                  <Text style={styles.description}>
                    {tab === "eligible"
                      ? orderId
                        ? "This order has no eligible items, or a return request already exists for each item."
                        : "No eligible products on this page."
                      : "No return requests on this page."}
                  </Text>
                )}

                {data.items.map((item) =>
                  tab === "eligible" ? (
                    <Pressable
                      key={item.orderItemId}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: selected === item.orderItemId,
                      }}
                      disabled={busy}
                      onPress={() => {
                        setSelected(item.orderItemId);
                        setError("");
                      }}
                      style={[
                        styles.card,
                        selected === item.orderItemId && styles.selected,
                      ]}
                    >
                      <Text style={styles.name}>{item.productName}</Text>
                      <Text style={styles.muted}>
                        Quantity: {item.quantity}
                      </Text>
                      <Text style={styles.muted}>{item.orderNumber}</Text>
                      <Text style={styles.link}>
                        {selected === item.orderItemId
                          ? "Selected"
                          : "Select this item"}
                      </Text>
                    </Pressable>
                  ) : (
                    <View key={item.id} style={styles.card}>
                      <Text style={styles.name}>{item.productName}</Text>
                      <Text style={styles.status}>{label(item.status)}</Text>
                      <Text style={styles.muted}>{item.orderNumber}</Text>
                      <Text style={styles.muted}>
                        Quantity: {item.quantity}
                      </Text>
                      <Text style={styles.description}>{item.reason}</Text>
                      {item.rejectionReason ? (
                        <Text style={styles.description}>
                          Rejection reason: {item.rejectionReason}. Your product
                          will be shipped back soon.
                        </Text>
                      ) : null}
                      <Text style={styles.name}>
                        Refund: {label(item.refundStatus)}
                      </Text>
                      {item.refundAmount != null && (
                        <Text style={styles.muted}>
                          Refund amount: PKR{" "}
                          {Number(item.refundAmount).toLocaleString("en-PK")}
                        </Text>
                      )}
                      <Text style={styles.muted}>
                        {new Date(item.createdAt).toLocaleDateString("en-PK")}
                      </Text>
                    </View>
                  ),
                )}

                {tab === "eligible" && selected && (
                  <View style={styles.form}>
                    <Text style={styles.name}>Reason for return</Text>
                    <TextInput
                      accessibilityLabel="Reason for return"
                      placeholder="Describe the issue with your purchased item"
                      placeholderTextColor="#94a3b8"
                      value={reason}
                      onChangeText={setReason}
                      editable={!busy}
                      maxLength={1000}
                      multiline
                      textAlignVertical="top"
                      style={styles.input}
                    />
                    <Text style={styles.muted}>{reason.length}/1000</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={submit}
                      style={styles.submit}
                    >
                      <Text style={styles.white}>
                        {busy ? "Submitting..." : "Submit return request"}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {data.totalPages > 1 && (
                  <View style={styles.pagination}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || page === 0}
                      onPress={() => {
                        setSelected(null);
                        setPage((value) => value - 1);
                      }}
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
                      onPress={() => {
                        setSelected(null);
                        setPage((value) => value + 1);
                      }}
                      style={styles.button}
                    >
                      <Text style={styles.link}>Next</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    gap: 8,
  },
  title: { fontSize: 21, fontWeight: "800", color: "#0f172a", flex: 1 },
  button: { backgroundColor: "#f5f3ff", padding: 12, borderRadius: 12 },
  link: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },
  tabs: { flexDirection: "row", paddingHorizontal: 18, gap: 10 },
  tab: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
  },
  activeTab: { backgroundColor: "#7c3aed" },
  white: { color: "#fff", fontWeight: "700", textAlign: "center" },
  content: { padding: 18, paddingBottom: 40 },
  refresh: { alignSelf: "flex-end", padding: 12, marginBottom: 10 },
  description: { color: "#64748b", lineHeight: 22, marginVertical: 12 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    marginBottom: 12,
  },
  selected: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
  name: { color: "#334155", fontWeight: "700", fontSize: 14 },
  muted: { color: "#64748b", fontSize: 12, marginVertical: 5 },
  status: {
    color: "#7c3aed",
    fontWeight: "700",
    marginTop: 10,
    textTransform: "capitalize",
  },
  form: { marginVertical: 15 },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    color: "#334155",
    fontSize: 14,
  },
  submit: {
    backgroundColor: "#7c3aed",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  notice: { color: "#15803d", lineHeight: 22, marginBottom: 14 },
  error: { color: "#be123c", lineHeight: 22, marginBottom: 14 },
});
