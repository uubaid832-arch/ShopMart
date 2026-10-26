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
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMobileOrders, getMobileTracking } from "../api/orders";
import CustomerInvoiceButton from "./CustomerInvoiceButton";
import RiderLocation from "./RiderLocation";

const readable = (value = "") => value.replaceAll("_", " ").toLowerCase();

const formatPrice = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
  }).format(Number(amount));

const iconPaths = {
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  close: "m6 6 12 12M6 18 18 6",
  back: "m14 5-7 7 7 7M7 12h14",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9M7.5 5.5l9 5",
  return: "M9 4 4 9l5 5M4 9h11a5 5 0 0 1 0 10h-3",
  truck:
    "M2 5h12v12H2V5Zm12 4h4l4 5v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
};

function Icon({ name, size = 21, color = "#7c3aed" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={iconPaths[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function statusColors(status) {
  if (["DELIVERED", "COMPLETED"].includes(status))
    return ["#ecfdf5", "#047857"];
  if (["CANCELLED", "DELIVERY_FAILED", "FAILED", "REJECTED"].includes(status))
    return ["#fff1f2", "#be123c"];
  if (["PENDING", "PLACED"].includes(status)) return ["#fffbeb", "#b45309"];
  return ["#f2ecff", "#7c3aed"];
}

function Status({ value }) {
  const [backgroundColor, color] = statusColors(value);
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{readable(value)}</Text>
    </View>
  );
}

export default function OrdersModal({ session, onClose, onOpenReturns }) {
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

  const refreshing = selected ? !trackingCurrent : !current;

  return (
    <Modal visible animationType="slide" onRequestClose={back}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          {selected && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to my orders"
              onPress={() => setSelected(null)}
              style={styles.iconButton}
            >
              <Icon name="back" color="#27304a" />
            </Pressable>
          )}
          <View style={styles.grow}>
            <Text style={styles.eyebrow}>SHOPMART PURCHASES</Text>
            <Text style={styles.title}>
              {selected ? "Order details" : "My orders"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh orders"
            disabled={refreshing}
            onPress={() => setReload((value) => value + 1)}
            style={[styles.iconButton, refreshing && styles.dim]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#7c3aed" />
            ) : (
              <Icon name="refresh" />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close orders"
            onPress={onClose}
            style={styles.iconButton}
          >
            <Icon name="close" color="#667085" />
          </Pressable>
        </View>

        <View style={styles.toolbar}>
          <View>
            <Text style={styles.toolbarTitle}>
              {selected ? selected.orderNumber : "Your shopping journey"}
            </Text>
            <Text style={styles.muted}>
              {selected
                ? "Track your latest delivery updates"
                : "Track purchases and manage returns"}
            </Text>
          </View>
          {onOpenReturns && (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenReturns}
              style={styles.returnButton}
            >
              <Icon name="return" size={17} />
              <Text style={styles.returnText}>Returns & refunds</Text>
            </Pressable>
          )}
        </View>

        {selected ? (
          <ScrollView contentContainerStyle={styles.content}>
            {!trackingCurrent ? (
              <ActivityIndicator color="#7c3aed" style={styles.loader} />
            ) : trackingResult.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {trackingResult.error}
              </Text>
            ) : (
              <>
                <View style={styles.statusCard}>
                  <View style={styles.statusIcon}>
                    <Icon name="truck" size={31} />
                  </View>
                  <Text style={styles.eyebrow}>CURRENT ORDER STATUS</Text>
                  <Text style={styles.statusTitle}>
                    {readable(trackingResult.data.status)}
                  </Text>
                  <Text style={styles.muted}>
                    Updates appear here as your order progresses.
                  </Text>
                </View>
                <CustomerInvoiceButton session={session} orderId={selected.id} />
                <RiderLocation
                  key={selected.id}
                  session={session}
                  order={selected}
                />
                <Text style={styles.sectionTitle}>Delivery timeline</Text>
                <View style={styles.card}>
                  {trackingResult.data.events.length === 0 && (
                    <Text style={styles.muted}>No tracking updates yet.</Text>
                  )}
                  {trackingResult.data.events.map((event, index) => (
                    <View key={event.id} style={styles.event}>
                      <View style={styles.timeline}>
                        <View style={styles.eventDot} />
                        {index < trackingResult.data.events.length - 1 && (
                          <View style={styles.eventLine} />
                        )}
                      </View>
                      <View style={styles.eventCopy}>
                        <Text style={styles.name}>{event.message}</Text>
                        <Text style={styles.muted}>
                          {new Date(event.createdAt).toLocaleString("en-PK")}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Text style={styles.sectionTitle}>Delivery address</Text>
                <View style={[styles.card, styles.addressCard]}>
                  <View style={styles.addressIcon}>
                    <Icon name="pin" />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.name}>{selected.delivery.name}</Text>
                    <Text style={styles.description}>
                      {selected.delivery.address}, {selected.delivery.city}
                    </Text>
                    <Text style={styles.description}>
                      {selected.delivery.phone}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        ) : !current ? (
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
              contentContainerStyle={styles.content}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Icon name="box" size={42} />
                  </View>
                  <Text style={styles.emptyTitle}>No orders on this page</Text>
                  <Text style={styles.muted}>
                    Your purchases will appear here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.orderIcon}>
                      <Icon name="box" size={21} />
                    </View>
                    <View style={styles.grow}>
                      <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                      <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString("en-PK", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                  <Status value={item.status} />
                  <CustomerInvoiceButton session={session} orderId={item.id} />
                  <View style={styles.products}>
                    {item.items.map((product) => (
                      <View key={product.productId} style={styles.productRow}>
                        <View style={styles.grow}>
                          <Text style={styles.productName}>{product.name}</Text>
                          <Text style={styles.muted}>
                            Qty {product.quantity}
                          </Text>
                        </View>
                        <Text style={styles.itemPrice}>
                          {formatPrice(
                            Number(product.price) * product.quantity,
                            item.currency,
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {Number(item.discountAmount) > 0 && (
                    <Text style={styles.payment}>
                      Voucher {item.voucherCode}: -
                      {formatPrice(item.discountAmount, item.currency)}
                    </Text>
                  )}
                  <View style={styles.totalRow}>
                    <View style={styles.grow}>
                      <Text style={styles.totalLabel}>Order total</Text>
                      <Text style={styles.payment}>
                        {item.paymentProvider === "SAFEPAY" ? "Safepay (Sandbox)" : item.paymentMethod === "COD"
                          ? "Cash on delivery"
                          : readable(item.paymentMethod)}
                      </Text>
                    </View>
                    <View style={styles.totalRight}>
                      <Text style={styles.total}>
                        {formatPrice(item.total, item.currency)}
                      </Text>
                      <Text style={styles.payment}>
                        {item.paymentProvider === "SAFEPAY" && item.paymentStatus === "DEMO_PAID" ? "Paid via Safepay" : readable(item.paymentStatus)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelected(item)}
                    style={styles.trackButton}
                  >
                    <Icon name="truck" size={19} color="#fff" />
                    <Text style={styles.trackText}>Track order</Text>
                  </Pressable>
                </View>
              )}
            />
            {data.totalPages > 1 && (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  disabled={page === 0}
                  onPress={() => setPage((value) => value - 1)}
                  style={[styles.pageButton, page === 0 && styles.dim]}
                >
                  <Text style={styles.link}>Previous</Text>
                </Pressable>
                <Text style={styles.muted}>
                  {page + 1} / {data.totalPages}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={page + 1 >= data.totalPages}
                  onPress={() => setPage((value) => value + 1)}
                  style={[
                    styles.pageButton,
                    page + 1 >= data.totalPages && styles.dim,
                  ]}
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
  screen: { flex: 1, backgroundColor: "#f8f9fd" },
  grow: { flex: 1, minWidth: 0 },
  header: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 9,
  },
  eyebrow: {
    color: "#9a8ab8",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#17203c",
    marginTop: 5,
    letterSpacing: -0.8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f5f2fc",
    alignItems: "center",
    justifyContent: "center",
  },
  dim: { opacity: 0.4 },
  toolbar: { padding: 18, gap: 13 },
  toolbarTitle: { color: "#31394f", fontSize: 14, fontWeight: "700" },
  muted: { color: "#8b93a8", fontSize: 11, lineHeight: 18, marginTop: 4 },
  returnButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#eee7fc",
    paddingHorizontal: 15,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#e1d5fa",
  },
  returnText: { color: "#6d28d9", fontSize: 12, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingBottom: 25 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e9eaf2",
    borderRadius: 22,
    padding: 17,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 14,
  },
  orderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f3effd",
    alignItems: "center",
    justifyContent: "center",
  },
  orderNumber: { fontSize: 12, fontWeight: "800", color: "#28314d" },
  date: { fontSize: 11, color: "#98a0b2", marginTop: 5 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    alignSelf: "flex-start",
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  products: {
    paddingTop: 5,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f1f6",
  },
  productRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    alignItems: "flex-start",
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    color: "#38415c",
  },
  itemPrice: {
    color: "#505a72",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: "44%",
    textAlign: "right",
    lineHeight: 20,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 17,
  },
  totalLabel: { fontSize: 12, color: "#626d87", fontWeight: "600" },
  totalRight: { alignItems: "flex-end", maxWidth: "55%" },
  total: {
    fontSize: 21,
    color: "#7c3aed",
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  payment: {
    fontSize: 10,
    color: "#9a9fb0",
    marginTop: 5,
    textTransform: "capitalize",
  },
  trackButton: {
    minHeight: 46,
    backgroundColor: "#7c3aed",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  trackText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  statusCard: {
    padding: 24,
    backgroundColor: "#f0eafb",
    borderRadius: 22,
    alignItems: "center",
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#e6dcfa",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  statusTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#6d28d9",
    marginVertical: 8,
    textTransform: "capitalize",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#27314b",
    marginTop: 23,
    marginBottom: 14,
  },
  event: { flexDirection: "row", gap: 12 },
  timeline: { width: 12, alignItems: "center" },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#a78bfa",
    marginTop: 5,
  },
  eventLine: { width: 2, backgroundColor: "#eee7fc", flex: 1, marginTop: 5 },
  eventCopy: { flex: 1, paddingBottom: 22 },
  name: { color: "#38415c", fontSize: 13, fontWeight: "700", lineHeight: 21 },
  description: { color: "#8891a7", fontSize: 12, marginTop: 7, lineHeight: 20 },
  addressCard: { flexDirection: "row", gap: 12 },
  addressIcon: {
    padding: 10,
    borderRadius: 13,
    backgroundColor: "#f3effd",
    alignSelf: "flex-start",
  },
  loader: { marginTop: 45 },
  error: { color: "#be123c", margin: 20, fontSize: 13, lineHeight: 22 },
  empty: { paddingVertical: 55, alignItems: "center" },
  emptyIcon: {
    padding: 25,
    borderRadius: 30,
    backgroundColor: "#efe9fb",
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 18, color: "#38415c", fontWeight: "700" },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
  },
  pageButton: { padding: 13, borderRadius: 12, backgroundColor: "#f2ecfc" },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
});
