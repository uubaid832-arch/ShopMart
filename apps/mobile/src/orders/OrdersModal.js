import { Text } from "../i18n/LocalizedNativeComponents.js";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMobileOrders, getMobileTracking, getMobileOrder } from "../api/orders";
import CustomerInvoiceButton from "./CustomerInvoiceButton";
import { canTrackLive, hasFinalOrderHistory, isProcessingOrder } from "./orderRules";
import RiderLocation from "./RiderLocation";
import { useMobileAppearance } from "../appearance/MobileAppearance";

const readable = (value = "") => value.replaceAll("_", " ").toLowerCase();

function paymentMethodLabel(order) {
  if (order.paymentProvider === "SAFEPAY" || order.paymentMethod === "DEMO") return "Safepay (Sandbox)";
  return order.paymentMethod === "COD" ? "Cash on delivery" : readable(order.paymentMethod);
}

function paymentStatusLabel(order) {
  if (order.paymentStatus === "DEMO_PAID" && (order.paymentProvider === "SAFEPAY" || order.paymentMethod === "DEMO")) return "Paid via Safepay";
  if (order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PAID") return "Bank transfer received";
  return readable(order.paymentStatus);
}

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

function Icon({ name, size = 21, color }) {
  const { theme } = useMobileAppearance();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={iconPaths[name]}
        stroke={color || theme.colors.accent}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function statusColors(status, palette, isDark) {
  if (["DELIVERED", "COMPLETED"].includes(status))
    return [isDark ? "#123b2e" : "#ecfdf5", palette.success];
  if (["CANCELLED", "DELIVERY_FAILED", "FAILED", "REJECTED"].includes(status))
    return [isDark ? "#3b202b" : "#fff1f2", palette.danger];
  if (["PENDING", "PLACED"].includes(status)) return [isDark ? "#3a301b" : "#fffbeb", palette.warning];
  return [palette.accentSoft, palette.accent];
}

function Status({ value, palette, isDark }) {
  const [backgroundColor, color] = statusColors(value, palette, isDark);
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{readable(value)}</Text>
    </View>
  );
}

const progressSteps = [
  { status: "PENDING", label: "Placed" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PICKED_UP", label: "Picked up" },
  { status: "DISPATCHED", label: "Dispatched" },
  { status: "DELIVERED", label: "Delivered" },
];

function OrderProgress({ status, events, palette }) {
  const stageByStatus = Object.fromEntries(progressSteps.map((step, index) => [step.status, index]));
  const statuses = [...(events || []).map(event => event.status), status];
  const completedIndex = statuses.reduce(
    (last, current) => Math.max(last, stageByStatus[current] ?? -1),
    -1,
  );
  const wasReturned = status === "RETURNED";
  const wasCancelled = status === "CANCELLED";
  const completeThrough = wasReturned ? progressSteps.length - 1 : completedIndex;

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressRow}>
        {progressSteps.map((step, index) => {
          const done = index <= completeThrough;
          return (
            <View key={step.status} style={styles.progressItem}>
              {index < progressSteps.length - 1 && (
                <View style={[styles.progressLine, { backgroundColor: index < completeThrough ? palette.accent : palette.border }]} />
              )}
              <View style={[styles.progressDot, { backgroundColor: done ? palette.accent : palette.border }]}>
                {done && <Text style={styles.progressCheck}>✓</Text>}
              </View>
              <Text style={[styles.progressLabel, { color: done ? palette.text : palette.muted }]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
      {(wasReturned || wasCancelled) && (
        <Text style={[styles.terminalStatus, { color: wasCancelled ? palette.danger : palette.accent }]}>
          {wasCancelled ? "This order was cancelled." : "This order was returned."}
        </Text>
      )}
    </View>
  );
}

export default function OrdersModal({ session, onClose, onOpenReturns }) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const token = session.accessToken;

  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selectedSummary, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const selected = detail?.id === selectedSummary?.id && detail?.token === token ? detail.order : selectedSummary;
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

  const selectedId = selectedSummary?.id;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    getMobileOrder(token, selectedId, controller.signal).then(order => {
      if (!controller.signal.aborted) setDetail({token, id:selectedId, order});
    }).catch(() => { /* Retain the purchased order details if refresh fails. */ });
    return () => controller.abort();
  }, [token, selectedId, reload]);
  const liveTracking = canTrackLive(selected?.status);

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
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <View style={[styles.header, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
          {selected && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to my orders"
              onPress={() => setSelected(null)}
              style={[styles.iconButton, { backgroundColor: palette.soft }]}
            >
              <Icon name="back" color={palette.text} />
            </Pressable>
          )}
          <View style={styles.grow}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>SHOPMART PURCHASES</Text>
            <Text style={[styles.title, { color: palette.text }]}>
              {selected ? "Order details" : "My orders"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh orders"
            disabled={refreshing}
            onPress={() => setReload((value) => value + 1)}
            style={[styles.iconButton, { backgroundColor: palette.soft }, refreshing && styles.dim]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={palette.accent} />
            ) : (
              <Icon name="refresh" />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close orders"
            onPress={onClose}
            style={[styles.iconButton, { backgroundColor: palette.soft }]}
          >
            <Icon name="close" color={palette.muted} />
          </Pressable>
        </View>

          <View style={[styles.toolbar, { backgroundColor: palette.background }]}>
          <View>
            <Text style={[styles.toolbarTitle, { color: palette.text }]}>
              {selected ? selected.orderNumber : "Your shopping journey"}
            </Text>
            <Text style={[styles.muted, { color: palette.muted }]}>
              {selected
                ? "Purchase details and tracking history"
                : "Track purchases and manage returns"}
            </Text>
          </View>
          {onOpenReturns && (
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenReturns(null)}
              style={[styles.returnButton, { backgroundColor: palette.accentSoft }]}
            >
              <Icon name="return" size={17} />
              <Text style={[styles.returnText, { color: palette.accent }]}>Returns & refunds</Text>
            </Pressable>
          )}
        </View>

        {selected ? (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.statusCard, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>ORDER DETAILS</Text>
              <Text style={[styles.statusTitle, { color: palette.text }]}>{readable(selected.status)}</Text>
              <Text style={[styles.muted, { color: palette.muted }]}>{selected.orderNumber} · {new Date(selected.createdAt).toLocaleString("en-PK")}</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Purchased items</Text>
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {selected.items.map(item => <View key={item.productId} style={styles.productRow}>
                <View style={styles.grow}><Text style={[styles.productName, { color: palette.text }]}>{item.name}</Text><Text style={[styles.muted, { color: palette.muted }]}>{formatPrice(item.price, selected.currency)} × {item.quantity}</Text></View>
                <Text style={[styles.itemPrice, { color: palette.text }]}>{formatPrice(Number(item.price) * item.quantity - Number(item.discountAmount || 0), selected.currency)}</Text>
              </View>)}
              {Number(selected.discountAmount) > 0 && <Text style={[styles.payment, { color: palette.muted }]}>Voucher {selected.voucherCode}: -{formatPrice(selected.discountAmount, selected.currency)}</Text>}
              <Text style={[styles.total, { color: palette.text }]}>Total: {formatPrice(selected.total, selected.currency)}</Text>
              <Text style={[styles.description, { color: palette.muted }]}>{paymentMethodLabel(selected)} · {paymentStatusLabel(selected)}</Text>
            </View>
            <CustomerInvoiceButton session={session} orderId={selected.id} />
            {selected.status === "DELIVERED" && onOpenReturns && (
            <Pressable accessibilityRole="button" onPress={() => onOpenReturns(selected.id)} style={[styles.returnButton, { backgroundColor: palette.accentSoft, borderColor: palette.accent, marginTop: 12 }]}>
                <Icon name="return" size={18} />
                <Text style={[styles.returnText, { color: palette.accent }]}>Request a return</Text>
              </Pressable>
            )}
            {liveTracking && <RiderLocation key={selected.id} session={session} order={selected} />}
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{hasFinalOrderHistory(selected.status) ? "Order history" : "Tracking history"}</Text>
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {!trackingCurrent ? <ActivityIndicator color={palette.accent} /> : trackingResult.error ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>{trackingResult.error}</Text> : <>
                <OrderProgress status={selected.status} events={trackingResult.data.events} palette={palette} />
                {trackingResult.data.events.length === 0 && <Text style={[styles.muted, { color: palette.muted }]}>No tracking history yet.</Text>}
                {trackingResult.data.events.map(event => <View key={event.id} style={styles.event}>
                  <View style={styles.timeline}><View style={[styles.eventDot, { backgroundColor: palette.accent }]} /></View>
                  <View style={styles.eventCopy}><Text style={[styles.name, { color: palette.text }]}>{event.message}</Text><Text style={[styles.muted, { color: palette.muted }]}>{new Date(event.createdAt).toLocaleString("en-PK")}</Text></View>
                </View>)}
              </>}
            </View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Delivery details</Text>
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.name, { color: palette.text }]}>{selected.delivery.name}</Text>
              <Text style={[styles.description, { color: palette.muted }]}>{selected.delivery.address}, {selected.delivery.city}</Text>
              <Text style={[styles.description, { color: palette.muted }]}>{selected.delivery.phone}</Text>
              <Text style={[styles.description, { color: palette.muted }]}>{selected.delivery.email}</Text>
            </View>
          </ScrollView>
        ) : !current ? (
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
              contentContainerStyle={styles.content}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={[styles.emptyIcon, { backgroundColor: palette.accentSoft }]}>
                    <Icon name="box" size={42} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: palette.text }]}>No orders on this page</Text>
                  <Text style={[styles.muted, { color: palette.muted }]}>
                    Your purchases will appear here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.orderIcon, { backgroundColor: palette.accentSoft }]}>
                      <Icon name="box" size={21} />
                    </View>
                    <View style={styles.grow}>
                      <Text style={[styles.orderNumber, { color: palette.text }]}>{item.orderNumber}</Text>
                      <Text style={[styles.date, { color: palette.muted }]}>
                        {new Date(item.createdAt).toLocaleDateString("en-PK", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                  <Status value={item.status} palette={palette} isDark={theme.isDark} />
                  <CustomerInvoiceButton session={session} orderId={item.id} />
                  <View style={[styles.products, { borderBottomColor: palette.border }]}>
                    {item.items.map((product) => (
                      <View key={product.productId} style={styles.productRow}>
                        <View style={styles.grow}>
                          <Text style={[styles.productName, { color: palette.text }]}>{product.name}</Text>
                          <Text style={[styles.muted, { color: palette.muted }]}>
                            Qty {product.quantity}
                          </Text>
                        </View>
                        <Text style={[styles.itemPrice, { color: palette.text }]}>
                          {formatPrice(
                            Number(product.price) * product.quantity,
                            item.currency,
                          )}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {Number(item.discountAmount) > 0 && (
                    <Text style={[styles.payment, { color: palette.muted }]}>
                      Voucher {item.voucherCode}: -
                      {formatPrice(item.discountAmount, item.currency)}
                    </Text>
                  )}
                  <View style={styles.totalRow}>
                    <View style={styles.grow}>
                      <Text style={[styles.totalLabel, { color: palette.muted }]}>Order total</Text>
                      <Text style={[styles.payment, { color: palette.muted }]}>
                        {paymentMethodLabel(item)}
                      </Text>
                    </View>
                    <View style={styles.totalRight}>
                      <Text style={[styles.total, { color: palette.text }]}>
                        {formatPrice(item.total, item.currency)}
                      </Text>
                      <Text style={[styles.payment, { color: palette.muted }]}>
                        {paymentStatusLabel(item)}
                      </Text>
                    </View>
                  </View>
                  {(isProcessingOrder(item.status) || hasFinalOrderHistory(item.status)) && (
                  <Pressable accessibilityRole="button" onPress={() => setSelected(item)} style={[styles.trackButton, { backgroundColor: palette.accent }]}>
                      <Icon name={isProcessingOrder(item.status) ? "truck" : "box"} size={19} color="#fff" />
                      <Text style={styles.trackText}>{isProcessingOrder(item.status) ? "Track order" : "View order history"}</Text>
                    </Pressable>
                  )}
                  {item.status === "DELIVERED" && onOpenReturns && (
                    <Pressable accessibilityRole="button" onPress={() => onOpenReturns(item.id)} style={[styles.returnButton, { backgroundColor: palette.accentSoft, borderColor: palette.accent, alignSelf: "stretch", justifyContent: "center", marginTop: 10 }]}>
                      <Icon name="return" size={18} />
                      <Text style={[styles.returnText, { color: palette.accent }]}>Return this order</Text>
                    </Pressable>
                  )}
                </View>
              )}
            />
            {data.totalPages > 1 && (
              <View style={[styles.pagination, { backgroundColor: palette.background }]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={page === 0}
                  onPress={() => setPage((value) => value - 1)}
                  style={[styles.pageButton, { backgroundColor: palette.accentSoft }, page === 0 && styles.dim]}
                >
                  <Text style={[styles.link, { color: palette.accent }]}>Previous</Text>
                </Pressable>
                <Text style={[styles.muted, { color: palette.muted }]}>
                  {page + 1} / {data.totalPages}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={page + 1 >= data.totalPages}
                  onPress={() => setPage((value) => value + 1)}
                  style={[
                    styles.pageButton,
                    { backgroundColor: palette.accentSoft },
                    page + 1 >= data.totalPages && styles.dim,
                  ]}
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
  progressWrap: { marginBottom: 20 },
  progressRow: { flexDirection: "row", alignItems: "flex-start" },
  progressItem: { flex: 1, minWidth: 0, alignItems: "center", position: "relative" },
  progressDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  progressCheck: { color: "#fff", fontSize: 13, lineHeight: 16, fontWeight: "900" },
  progressLine: { position: "absolute", left: "50%", width: "100%", top: 10, height: 3 },
  progressLabel: { marginTop: 7, marginRight: 2, fontSize: 10, lineHeight: 13, fontWeight: "700", textAlign: "center" },
  terminalStatus: { marginTop: 14, fontSize: 13, fontWeight: "700" },
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
