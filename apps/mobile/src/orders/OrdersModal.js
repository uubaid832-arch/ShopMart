import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMobileOrders, getMobileTracking } from "../api/orders";

const readable = (value = "") => value.replaceAll("_", " ").toLowerCase();

const formatPrice = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
  }).format(Number(amount));

export default function OrdersModal({ session, onClose }) {
  const token = session.accessToken;

  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [trackingResult, setTrackingResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    getMobileOrders(token, page, controller.signal)
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

  const selectedId = selected?.id;

  useEffect(() => {
    if (!selectedId) return;

    const controller = new AbortController();

    getMobileTracking(token, selectedId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setTrackingResult({
            token,
            id: selectedId,
            reload,
            data,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setTrackingResult({
            token,
            id: selectedId,
            reload,
            data: null,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, selectedId, reload]);

  const current =
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload;

  const data = current ? result.data : null;

  const trackingCurrent =
    trackingResult?.token === token &&
    trackingResult?.id === selectedId &&
    trackingResult?.reload === reload;

  function back() {
    if (selected) setSelected(null);
    else onClose();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={back}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {selected && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelected(null)}
              >
                <Text style={styles.back}>← My orders</Text>
              </Pressable>
            )}
            <Text style={styles.title}>
              {selected ? "Order tracking" : "My orders"}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close orders"
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setReload((current) => current + 1)}
          style={styles.refresh}
        >
          <Text style={styles.link}>Refresh updates</Text>
        </Pressable>

        {selected ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.reference}>{selected.orderNumber}</Text>

            {!trackingCurrent ? (
              <ActivityIndicator color="#7c3aed" style={{ marginTop: 24 }} />
            ) : trackingResult.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {trackingResult.error}
              </Text>
            ) : (
              <>
                <View style={styles.statusCard}>
                  <Text style={styles.muted}>CURRENT STATUS</Text>
                  <Text style={styles.statusTitle}>
                    {readable(trackingResult.data.status)}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Tracking updates</Text>

                {trackingResult.data.events.map((event) => (
                  <View key={event.id} style={styles.event}>
                    <Text style={styles.name}>{event.message}</Text>
                    <Text style={styles.muted}>
                      {new Date(event.createdAt).toLocaleString("en-PK")}
                    </Text>
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Delivery address</Text>
                <View style={styles.card}>
                  <Text style={styles.name}>{selected.delivery.name}</Text>
                  <Text style={styles.description}>
                    {selected.delivery.address}, {selected.delivery.city}
                  </Text>
                  <Text style={styles.description}>
                    {selected.delivery.phone}
                  </Text>
                </View>

                <Text style={styles.description}>
                  Live rider location is not connected yet.
                </Text>
              </>
            )}
          </ScrollView>
        ) : !current ? (
          <ActivityIndicator
            size="large"
            color="#7c3aed"
            style={{ marginTop: 40 }}
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
              contentContainerStyle={styles.content}
              ListEmptyComponent={
                <Text style={styles.empty}>No orders on this page.</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.badge}>{readable(item.status)}</Text>
                    <Text style={styles.muted}>
                      {new Date(item.createdAt).toLocaleDateString("en-PK")}
                    </Text>
                  </View>

                  {item.items.map((product) => (
                    <View key={product.productId} style={styles.item}>
                      <Text style={styles.itemName}>
                        {product.name} × {product.quantity}
                      </Text>
                      <Text style={styles.itemPrice}>
                        {formatPrice(
                          Number(product.price) * product.quantity,
                          item.currency,
                        )}
                      </Text>
                    </View>
                  ))}

                  <Text style={styles.total}>
                    {formatPrice(item.total, item.currency)}
                  </Text>

                  <Text style={styles.description}>
                    {item.paymentMethod === "COD"
                      ? "Cash on delivery"
                      : item.paymentMethod}
                    {" · "}
                    {readable(item.paymentStatus)}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelected(item)}
                    style={styles.primary}
                  >
                    <Text style={styles.primaryText}>Track this order</Text>
                  </Pressable>
                </View>
              )}
            />

            {data.totalPages > 1 && (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  disabled={page === 0}
                  onPress={() => setPage((current) => current - 1)}
                  style={styles.pageButton}
                >
                  <Text style={styles.link}>← Previous</Text>
                </Pressable>

                <Text style={styles.muted}>
                  {page + 1} / {data.totalPages}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={page + 1 >= data.totalPages}
                  onPress={() => setPage((current) => current + 1)}
                  style={styles.pageButton}
                >
                  <Text style={styles.link}>Next →</Text>
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
    padding: 20,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 25, fontWeight: "800", color: "#0f172a" },
  back: { color: "#7c3aed", fontSize: 12, marginBottom: 8, fontWeight: "600" },
  close: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 28, color: "#64748b" },
  refresh: {
    alignSelf: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    color: "#7c3aed",
    backgroundColor: "#f5f3ff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  muted: { color: "#94a3b8", fontSize: 11, marginTop: 5 },
  item: { flexDirection: "row", gap: 12, marginTop: 16 },
  itemName: { flex: 1, color: "#334155", fontSize: 13, lineHeight: 20 },
  itemPrice: { color: "#475569", fontSize: 12, fontWeight: "700" },
  total: { color: "#7c3aed", fontSize: 23, fontWeight: "800", marginTop: 18 },
  description: { color: "#64748b", fontSize: 12, lineHeight: 20, marginTop: 8 },
  primary: {
    padding: 13,
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    marginTop: 16,
  },
  primaryText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 12,
  },
  reference: { fontSize: 11, color: "#94a3b8", marginBottom: 16 },
  statusCard: { backgroundColor: "#ede9fe", padding: 20, borderRadius: 18 },
  statusTitle: {
    color: "#6d28d9",
    fontWeight: "800",
    fontSize: 25,
    marginTop: 8,
    textTransform: "capitalize",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 24,
    marginBottom: 14,
  },
  event: {
    borderLeftWidth: 2,
    borderLeftColor: "#c4b5fd",
    paddingLeft: 16,
    paddingBottom: 24,
  },
  name: { color: "#334155", fontWeight: "700", fontSize: 13, lineHeight: 20 },
  error: { color: "#be123c", fontSize: 13, margin: 20, lineHeight: 21 },
  empty: { color: "#64748b", textAlign: "center", paddingVertical: 40 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
  },
  pageButton: { padding: 10, backgroundColor: "#f5f3ff", borderRadius: 10 },
});
