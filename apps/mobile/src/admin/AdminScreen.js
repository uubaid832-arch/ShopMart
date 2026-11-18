import { Text, TextInput } from "../i18n/LocalizedNativeComponents.js";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import {
  adminRequest,
  dateLabel,
  money,
  readable,
  useAdminResource,
} from "./adminApi";
import { Warehouse } from "./AdminLogistics";
import AdminOrderTracking from "./AdminOrderTracking";
import AdminInvoiceButton from "./AdminInvoiceButton";
import { AdminModule } from "./AdminModules";
import NotificationsModal from "../notifications/NotificationsModal";
import NotificationBell from "../notifications/NotificationBell";
import ProfileModal from "../account/ProfileModal";
import ChangePasswordModal from "../account/ChangePasswordModal";
import BiometricSettingsModal from "../account/BiometricSecurity";
import { useMobileAppearance } from "../appearance/MobileAppearance";
import { setAdminPalette } from "./adminUi";
import AppearanceModal from "../appearance/AppearanceModal";
import { useMobileLanguage } from "../i18n/MobileLanguage";

let themePalette = {
  background: "#f8f9fc", surface: "#fff", elevated: "#fff", soft: "#f3f5f8",
  text: "#17243b", muted: "#718096", border: "#e2e8f0", accent: "#2864d8",
  accentSoft: "#edf4ff", warning: "#a66b12", warningSoft: "#fff6e2",
  danger: "#be123c", dangerSoft: "#fff1f2", success: "#2d8b57", successSoft: "#e9f7ef",
};

const paths = {
  ticket: "M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Zm12 0v2m0 3v2m0 3v2",
  menu: "M4 6h16M4 12h16M4 18h16",
  categories: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7",
  returns: "m9 10-5-5 5-4M4 5h9a8 8 0 0 1 0 16H6",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6",
  people:
    "M16 21v-2a6 6 0 0 0-12 0v2M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m3 5a5 5 0 0 1 4 5v4M17 3a4 4 0 0 1 0 8",
  receipt: "M5 3h14v19l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6m-6 4h4",
  home: "M3 10 12 3l9 7v10h-6v-7H9v7H3V10Z",
  grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9M7.5 5.5l9 5",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  user: "M20 21v-2a8 8 0 0 0-16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  truck:
    "M2 5h12v12H2V5Zm12 4h4l4 5v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  arrow: "m9 5 7 7-7 7",
  languages: "M4 5h12M10 3v2m4 0c-.6 4-3.2 7-7 9m-3-5c2.3 3.4 5 5.4 9 7M14 20l4-9 4 9m-6.7-3h5.4",
  down: "m5 9 7 7 7-7",
  up: "m5 15 7-7 7 7",
  back: "m15 5-7 7 7 7",
  close: "m6 6 12 12M6 18 18 6",
  wallet: "M3 5h16v15H3V5Zm0 0 13-3v3m-1 5h6v6h-6v-6m3 3h.01",
  check: "m5 12 4 4L19 6",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
  palette: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a1.5 1.5 0 0 1 0-3h3a6 6 0 0 0 6-6c0-2.8-4-5-9-5ZM7.5 10h.01M10 6.5h.01M15 6.5h.01M17.5 10h.01",
};
function Icon({ name, size = 21, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color || themePalette.accent}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconButton({ icon, label, onPress, disabled, compact = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[s.iconButton, compact && s.compactIconButton, disabled && s.dim]}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
function Button({
  title,
  icon,
  onPress,
  disabled,
  danger = false,
  secondary = false,
}) {
  const { theme } = useMobileAppearance();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && s.danger,
        (disabled || pressed) && s.dim,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={danger ? theme.colors.danger : secondary ? theme.colors.accent : "#fff"}
        />
      )}
      <Text style={[s.buttonText, secondary && s.link, danger && s.dangerText]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Status({ value }) {
  const { theme } = useMobileAppearance();
  const tone =
    value === "DELIVERED"
      ? { bg: theme.colors.successSoft, fg: theme.colors.success }
      : value === "CANCELLED"
        ? { bg: theme.colors.dangerSoft, fg: theme.colors.danger }
        : value === "PENDING"
          ? { bg: theme.isDark ? "#3b3020" : "#fff5de", fg: theme.colors.warning }
          : { bg: theme.colors.accentSoft, fg: theme.colors.accent };
  return (
    <View style={[s.status, { backgroundColor: tone.bg }]}>
      <Text style={[s.statusText, { color: tone.fg }]}>{readable(value)}</Text>
    </View>
  );
}
function paymentLabel(order) {
  if (order.paymentProvider === "SAFEPAY" || order.paymentMethod === "DEMO") {
    return order.paymentStatus === "DEMO_PAID" ? "Paid via Safepay" : readable(order.paymentStatus);
  }
  if (order.paymentMethod === "BANK_TRANSFER") {
    return order.paymentStatus === "PAID" ? "Bank transfer received" : "Pending receipt confirmation";
  }
  return readable(order.paymentStatus);
}
function ErrorMessage({ message, onRetry }) {
  return (
    <View style={s.errorBox}>
      <Text accessibilityRole="alert" style={s.error}>
        {message}
      </Text>
      {onRetry && <Button title="Try again" secondary onPress={onRetry} />}
    </View>
  );
}
function OrderCard({ order, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open order ${order.orderNumber}`}
      onPress={onPress}
      style={({ pressed }) => [s.orderCard, pressed && s.dim]}
    >
      <View style={s.row}>
        <View style={s.grow}>
          <Text style={s.orderNumber}>{order.orderNumber}</Text>
          <Text style={s.customer}>
            {order.customerName || "Customer order"}
          </Text>
        </View>
        <Status value={order.status} />
      </View>
      <View style={[s.row, s.cardFoot]}>
        <View style={s.grow}>
          <Text style={s.muted}>{dateLabel(order.createdAt)}</Text>
          {order.paymentMethod && (
            <Text style={s.muted}>
              {order.paymentProvider === "SAFEPAY" || order.paymentMethod === "DEMO" ? "Safepay (Sandbox)" : order.paymentMethod === "COD"
                ? "Cash on delivery"
                : readable(order.paymentMethod)}{" "}
              · {paymentLabel(order)}
            </Text>
          )}
        </View>
        <Text style={s.orderAmount}>{money(order.total, order.currency)}</Text>
        <Icon name="arrow" size={16} color={themePalette.muted} />
      </View>
    </Pressable>
  );
}

function OrderDetails({ session, orderId, onBack, onChanged, onBusyChanged }) {
  const [revision, setRevision] = useState(0);
  const [riderId, setRiderId] = useState("");
  const [riderSearch, setRiderSearch] = useState("");
  const [riderPickerOpen, setRiderPickerOpen] = useState(false);
  const [warehouseDelivery, setWarehouseDelivery] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const orderPath = `/orders/${encodeURIComponent(orderId)}`;
  const assignmentPath = `/deliveries/${encodeURIComponent(orderId)}/assignment`;
  const detail = useAdminResource(session.accessToken, orderPath, revision);
  const assignment = useAdminResource(
    session.accessToken,
    assignmentPath,
    revision,
  );
  const warehouse = useAdminResource(
    session.accessToken,
    `/deliveries/${encodeURIComponent(orderId)}/warehouse`,
    revision,
  );
  const order = detail.data;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (assignment.data) setRiderId(assignment.data.delivery.riderId || "");
    if (detail.data && assignment.data) setUncertain(false);
  }, [assignment.data, detail.data]);

  function refresh() {
    if (!pending.current) setRevision((v) => v + 1);
  }
  async function mutate(path, method, values, success) {
    if (pending.current || uncertain) return;
    pending.current = true;
    onBusyChanged(true);
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await adminRequest(session.accessToken, path, { method, values });
      if (mounted.current) {
        setNotice(success);
        onChanged();
      }
    } catch (failure) {
      if (mounted.current) {
        setUncertain(true);
        setError(
          `${failure.message || "The result could not be confirmed."} Checking the current order before another action.`,
        );
      }
    } finally {
      pending.current = false;
      onBusyChanged(false);
      if (mounted.current) {
        setBusy(false);
        setRevision((v) => v + 1);
      }
    }
  }
  function changeStatus(status) {
    const messages = {
      CONFIRMED: "Confirm this customer order?",
      DISPATCHED:
        "Confirm the parcel has been handed to the assigned rider? The customer and rider will receive an update.",
      CANCELLED:
        "Cancel this order? Product stock will be restored. This does not issue a payment refund.",
    };
    Alert.alert(readable(status), messages[status], [
      { text: "Go back", style: "cancel" },
      {
        text: status === "CANCELLED" ? "Cancel order" : "Confirm",
        style: status === "CANCELLED" ? "destructive" : "default",
        onPress: () =>
          mutate(
            `${orderPath}/status`,
            "PATCH",
            { status },
            `Order ${readable(status).toLowerCase()}.`,
          ),
      },
    ]);
  }
  function confirmBankTransferReceipt() {
    Alert.alert(
      "Confirm receipt",
      "Confirm only after reviewing the receipt. This demo action marks the transfer received in ShopMart; it does not verify a bank account.",
      [
        { text: "Go back", style: "cancel" },
        {
          text: "Confirm receipt",
          onPress: () => mutate(
            `${orderPath}/bank-transfer/confirm`,
            "POST",
            undefined,
            "Receipt confirmed. You can now confirm the order.",
          ),
        },
      ],
    );
  }
  const loading = detail.loading || assignment.loading;
  const canDispatch =
    assignment.data?.delivery.riderId && assignment.data.delivery.riderEnabled;
  const locked =
    busy || uncertain || loading || Boolean(detail.error || assignment.error);
  if (warehouseDelivery)
    return (
      <Warehouse
        session={session}
        delivery={warehouseDelivery}
        onClose={() => {
          setWarehouseDelivery(null);
          refresh();
        }}
        onBack={() => {
          setWarehouseDelivery(null);
          refresh();
        }}
        onChanged={() => {
          onChanged();
          refresh();
        }}
      />
    );
  return (
    <>
      <View style={s.header}>
        <IconButton
          icon="back"
          label="Back to orders"
          disabled={busy}
          onPress={onBack}
        />
        <View style={s.grow}>
          <Text style={s.eyebrow}>ORDER MANAGEMENT</Text>
          <Text style={s.title}>Order details</Text>
        </View>
        <IconButton
          icon="refresh"
          label="Refresh order"
          disabled={busy || loading}
          onPress={refresh}
        />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {busy && (
          <View style={s.inline}>
            <ActivityIndicator color={themePalette.accent} />
            <Text style={s.muted}>Saving your change...</Text>
          </View>
        )}
        {notice ? <Text style={s.success}>{notice}</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator size="large" color={themePalette.accent} style={s.loader} />
        ) : detail.error ? (
          <ErrorMessage message={detail.error} onRetry={refresh} />
        ) : (
          order && (
            <>
              <View style={s.card}>
                <View style={s.row}>
                  <Text selectable style={[s.orderNumber, s.grow]}>
                    {order.orderNumber}
                  </Text>
                  <Status value={order.status} />
                </View>
                <Text style={s.total}>
                  {money(order.total, order.currency)}
                </Text>
                {Number(order.discountAmount) > 0 && (
                  <Text style={s.muted}>
                    Voucher {order.voucherCode}: -
                    {money(order.discountAmount, order.currency)}
                  </Text>
                )}
                <Text style={s.muted}>
                  {order.paymentProvider === "SAFEPAY" || order.paymentMethod === "DEMO" ? "Safepay (Sandbox)" : order.paymentMethod === "COD"
                    ? "Cash on delivery"
                    : readable(order.paymentMethod)}{" "}
                  · {paymentLabel(order)}
                </Text>
                <Text style={s.muted}>{dateLabel(order.createdAt)}</Text>
                <AdminInvoiceButton
                  session={session}
                  orderId={orderId}
                  disabled={busy}
                />
              </View>
              <AdminOrderTracking
                session={session}
                order={order}
                revision={revision}
              />
              <View style={s.card}>
                <View style={s.inline}>
                  <Icon name="user" />
                  <Text style={s.cardTitle}>Customer & delivery</Text>
                </View>
                <Text selectable style={s.customer}>
                  {order.delivery?.name}
                </Text>
                <Text selectable style={s.body}>
                  {order.delivery?.email}
                </Text>
                <Text selectable style={s.body}>
                  {order.delivery?.phone}
                </Text>
                <Text selectable style={s.body}>
                  {[order.delivery?.address, order.delivery?.city]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
              <View style={s.card}>
                <View style={s.inline}>
                  <Icon name="box" />
                  <Text style={s.cardTitle}>Purchased items</Text>
                </View>
                {order.items.map((item, index) => (
                  <View key={`${item.productId}-${index}`} style={s.itemRow}>
                    <View style={s.quantityBadge}>
                      <Text style={s.link}>×{item.quantity}</Text>
                    </View>
                    <View style={s.grow}>
                      <Text style={s.itemName}>{item.name}</Text>
                      <Text style={s.muted}>
                        {money(item.price, order.currency)} each
                      </Text>
                    </View>
                    <Text style={s.itemName}>
                      {money(
                        Number(item.price) * item.quantity,
                        order.currency,
                      )}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={s.card}>
                <View style={s.inline}>
                  <Icon name="truck" />
                  <Text style={s.cardTitle}>Rider assignment</Text>
                </View>
                {assignment.error ? (
                  <ErrorMessage message={assignment.error} onRetry={refresh} />
                ) : (
                  <>
                    <Text style={s.body}>
                      {assignment.data?.delivery.riderName
                        ? `Assigned to ${assignment.data.delivery.riderName}${assignment.data.delivery.riderEnabled ? "" : " (account disabled)"}`
                        : "No rider assigned yet."}
                    </Text>
                    {order.status === "DISPATCHED" &&
                      (warehouse.loading ? (
                        <ActivityIndicator color={themePalette.accent} />
                      ) : warehouse.error ? (
                        <ErrorMessage
                          message={warehouse.error}
                          onRetry={refresh}
                        />
                      ) : warehouse.data?.attemptId &&
                        !warehouse.data.resolvedAt ? (
                        <>
                          <Text style={s.muted}>
                            This delivery was unsuccessful. Confirm warehouse
                            receipt, then select a rider for the next delivery
                            attempt.
                          </Text>
                          <Button
                            title="Change rider / arrange another delivery"
                            icon="truck"
                            secondary
                            disabled={locked}
                            onPress={() =>
                              setWarehouseDelivery({
                                orderId: order.id,
                                orderNumber: order.orderNumber,
                              })
                            }
                          />
                        </>
                      ) : null)}
                    {order.status === "CONFIRMED" ? (
                      <>
                        <Text style={s.muted}>
                          Choose an active rider before dispatching.
                        </Text>
                        {(assignment.data?.riders ?? []).length ? (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Choose an active rider"
                              accessibilityState={{ expanded: riderPickerOpen }}
                              disabled={locked}
                              onPress={() => setRiderPickerOpen((open) => !open)}
                              style={[s.riderChoice, s.riderSelect]}
                            >
                              <Text style={[s.body, s.grow]}>
                                {(assignment.data.riders ?? []).find((rider) => rider.id === riderId)?.name || "Tap to choose an active rider"}
                              </Text>
                              <Icon name={riderPickerOpen ? "up" : "down"} size={17} />
                            </Pressable>
                            {riderPickerOpen && (
                              <View style={s.riderPickerMenu}>
                                <TextInput
                                  accessibilityLabel="Search active riders"
                                  placeholder="Search by rider name"
                                  value={riderSearch}
                                  onChangeText={setRiderSearch}
                                  editable={!locked}
                                  autoCapitalize="words"
                                  style={s.riderSearch}
                                />
                                {(assignment.data.riders ?? []).filter((rider) =>
                                  String(rider.name || "").toLowerCase().includes(riderSearch.trim().toLowerCase()),
                                ).map((rider) => (
                                  <Pressable
                                    key={rider.id}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: riderId === rider.id }}
                                    disabled={locked}
                                    onPress={() => {
                                      setRiderId(rider.id);
                                      setRiderPickerOpen(false);
                                      setRiderSearch("");
                                    }}
                                    style={[s.riderChoice, riderId === rider.id && s.riderSelected]}
                                  >
                                    <View style={[s.radio, riderId === rider.id && s.radioSelected]}>
                                      {riderId === rider.id && <Icon name="check" size={12} color="#fff" />}
                                    </View>
                                    <Text style={[s.body, s.grow]}>{rider.name}</Text>
                                  </Pressable>
                                ))}
                                {(assignment.data.riders ?? []).filter((rider) =>
                                  String(rider.name || "").toLowerCase().includes(riderSearch.trim().toLowerCase()),
                                ).length === 0 && <Text style={s.muted}>No active rider matches that search.</Text>}
                              </View>
                            )}
                          </>
                        ) : (
                          <Text style={s.muted}>
                            No enabled riders. Create or enable a rider using
                            the web admin portal.
                          </Text>
                        )}
                        <Button
                          title="Save rider assignment"
                          icon="truck"
                          secondary
                          disabled={
                            locked ||
                            !riderId ||
                            riderId === assignment.data?.delivery.riderId
                          }
                          onPress={() => {
                            const rider = assignment.data.riders.find(
                              (item) => item.id === riderId,
                            );
                            Alert.alert(
                              "Assign rider?",
                              `Assign this order to ${rider?.name || "the selected rider"}?`,
                              [
                                { text: "Go back", style: "cancel" },
                                {
                                  text: "Assign rider",
                                  onPress: () =>
                                    mutate(
                                      assignmentPath,
                                      "PUT",
                                      { riderId },
                                      "Rider assignment saved.",
                                    ),
                                },
                              ],
                            );
                          }}
                        />
                      </>
                    ) : (
                      <Text style={s.muted}>
                        {order.status === "PENDING"
                          ? "Confirm the order to assign a rider."
                          : ["DELIVERED", "CANCELLED", "RETURNED"].includes(
                                order.status,
                              )
                            ? "This delivery is closed. Its history is shown below."
                            : "Rider changes are managed through the delivery and warehouse workflow after dispatch."}
                      </Text>
                    )}
                  </>
                )}
              </View>
              {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Order actions</Text>
                  {order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING" ? (
                    <>
                      <Text style={s.muted}>Receipt is pending manual review. This demo does not connect to a bank.</Text>
                      <Button title="Confirm receipt received" icon="check" disabled={locked} onPress={confirmBankTransferReceipt} />
                    </>
                  ) : order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PAID" ? (
                    <Text style={s.success}>Bank transfer received (admin confirmed).</Text>
                  ) : null}
                  {order.status === "PENDING" && (
                    <>
                    {!(order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING") && <Button
                      title="Confirm order"
                      icon="check"
                      disabled={locked}
                      onPress={() => changeStatus("CONFIRMED")}
                    />}
                    </>
                  )}
                  {order.status === "CONFIRMED" && (
                    <>
                      <Button
                        title="Mark as dispatched"
                        icon="truck"
                        disabled={locked || !canDispatch}
                        onPress={() => changeStatus("DISPATCHED")}
                      />
                      {!canDispatch && (
                        <Text style={s.muted}>
                          Save an enabled rider assignment before dispatching.
                        </Text>
                      )}
                    </>
                  )}
                  {!(order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PAID") && (
                    <Button
                      title="Cancel order"
                      icon="close"
                      danger
                      disabled={locked}
                      onPress={() => changeStatus("CANCELLED")}
                    />
                  )}
                </View>
              )}
              {order.status === "DISPATCHED" && (
                <View style={s.info}>
                  <Icon name="truck" />
                  <Text style={[s.body, s.grow]}>
                    The assigned rider confirms delivery and COD collection from
                    the rider app.
                  </Text>
                </View>
              )}
            </>
          )
        )}
      </ScrollView>
    </>
  );
}

function OrdersModal({
  session,
  initialId,
  initialStatus = "ALL",
  onClose,
  onChanged,
}) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(initialId || null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const detailBusy = useRef(false);
  const result = useAdminResource(
    session.accessToken,
    `/orders?page=${page}&size=15&search=${encodeURIComponent(search.trim())}`,
    revision,
  );
  const items = (result.data?.items || []).filter(
    (order) => status === "ALL" || status === order.status,
  );
  function changed() {
    setRevision((v) => v + 1);
    onChanged();
  }
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!detailBusy.current) {
          if (selected) setSelected(null);
          else onClose();
        }
      }}
    >
      <SafeAreaView style={s.screen}>
        {selected ? (
          <OrderDetails
            key={selected}
            session={session}
            orderId={selected}
            onBack={() => setSelected(null)}
            onChanged={changed}
            onBusyChanged={(value) => {
              detailBusy.current = value;
            }}
          />
        ) : (
          <>
            <View style={s.header}>
              <View style={s.grow}>
                <Text style={s.eyebrow}>SHOPMART ADMIN</Text>
                <Text style={s.title}>Customer orders</Text>
              </View>
              <IconButton
                icon="refresh"
                label="Refresh orders"
                disabled={result.loading}
                onPress={() => setRevision((v) => v + 1)}
              />
              <IconButton icon="close" label="Close orders" onPress={onClose} />
            </View>
            <View style={s.filters}>
              <View style={s.search}>
                <Icon name="search" size={19} color={themePalette.muted} />
                <TextInput
                  value={search}
                  onChangeText={(value) => {
                    setSearch(value);
                    setPage(0);
                  }}
                  accessibilityLabel="Search all orders"
                  placeholder="Order number or customer"
                  placeholderTextColor={themePalette.muted}
                  style={s.input}
                  autoCorrect={false}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
              >
                {[
                  "ALL",
                  "PENDING",
                  "CONFIRMED",
                  "DISPATCHED",
                  "DELIVERED",
                  "CANCELLED",
                  "RETURNED",
                ].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: status === value }}
                    onPress={() => setStatus(value)}
                    style={[s.chip, status === value && s.chipActive]}
                  >
                    <Text style={[s.chipText, status === value && s.white]}>
                      {readable(value)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={s.muted}>
                Search covers all orders; status filters apply to the results.{" "}
                {result.data
                  ? `${result.data.totalItems} orders in total.`
                  : ""}
              </Text>
            </View>
            {result.loading ? (
              <ActivityIndicator
                size="large"
                color={themePalette.accent}
                style={s.loader}
              />
            ) : result.error ? (
              <ErrorMessage
                message={result.error}
                onRetry={() => setRevision((v) => v + 1)}
              />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.orderList}
                renderItem={({ item }) => (
                  <OrderCard
                    order={item}
                    onPress={() => setSelected(item.id)}
                  />
                )}
                ListEmptyComponent={
                  <View style={s.empty}>
                    <Icon name="box" size={40} />
                    <Text style={s.sectionTitle}>No matching orders</Text>
                    <Text style={s.muted}>
                      Try another search or status filter.
                    </Text>
                  </View>
                }
              />
            )}
            <View style={s.pagination}>
              <IconButton
                icon="back"
                label="Previous page"
                disabled={result.loading || page === 0}
                onPress={() => setPage((v) => v - 1)}
              />
              <Text style={s.muted}>
                Page {page + 1} of {Math.max(1, result.data?.totalPages || 1)}
              </Text>
              <IconButton
                icon="arrow"
                label="Next page"
                disabled={
                  result.loading ||
                  !result.data ||
                  page + 1 >= result.data.totalPages
                }
                onPress={() => setPage((v) => v + 1)}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function WarehouseAddressSettings({ session }) {
  const { theme } = useMobileAppearance();
  const palette = {
    ...theme.colors,
    accent: theme.accent === "violet" ? theme.isDark ? "#8db7ff" : "#2864d8" : theme.colors.accent,
    accentSoft: theme.accent === "violet" ? theme.isDark ? "#1d2d49" : "#edf4ff" : theme.colors.accentSoft,
    warningSoft: theme.isDark ? "#3c3423" : "#fff6e2",
  };
  const defaults = { operatingCities: ["Lahore"], warehouseAddressLine: "", warehouseCity: "Lahore", warehousePhone: "", whatsappNumber: "923263101049", bankName: "ShopMart Demo Bank (fictional)", bankAccountTitle: "ShopMart Test Store", bankAccountNumber: "0000 0000 0000", bankIban: "PK00-DEMO-0000-0000-0000" };
  const [profile, setProfile] = useState(defaults);
  const [operatingCities, setOperatingCities] = useState(["Lahore"]);
  const [cityDraft, setCityDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    adminRequest(session.accessToken, "/settings/store-profile", { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        const current = { ...defaults, ...value };
        setProfile(current);
        setOperatingCities(current.operatingCities || []);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session.accessToken]);

  useEffect(() => {
    if (!error && !notice) return undefined;
    const timer = setTimeout(() => { setError(""); setNotice(""); }, 3500);
    return () => clearTimeout(timer);
  }, [error, notice]);

  function addCity() {
    const city = cityDraft.trim().replace(/\s+/g, " ");
    if (!city) return;
    setOperatingCities((current) => current.some((value) => value.toLowerCase() === city.toLowerCase()) ? current : [...current, city]);
    setCityDraft("");
  }

  async function saveSettings() {
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await adminRequest(session.accessToken, "/settings/store-profile", {
        method: "PUT", values: { ...profile, operatingCities },
      });
      setProfile(saved);
      setOperatingCities(saved.operatingCities || []);
      setNotice("Store settings saved. Checkout and return instructions use the updated details.");
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  }

  const fields = [
    ["Warehouse street address", "warehouseAddressLine", "Street, building, and area", 1000],
    ["Warehouse city", "warehouseCity", "City", 100],
    ["Warehouse contact number", "warehousePhone", "Optional contact number", 32],
    ["Customer WhatsApp number with country code", "whatsappNumber", "923263101049", 32],
    ["Bank name", "bankName", "Bank name", 120],
    ["Account title", "bankAccountTitle", "Account title", 120],
    ["Account number", "bankAccountNumber", "Account number", 80],
    ["IBAN", "bankIban", "IBAN", 80],
  ];

  return (
    <View style={s.card}>
      <View style={s.inline}><Icon name="home" /><Text style={s.cardTitle}>Store delivery & payment settings</Text></View>
      <Text style={[s.muted, { marginTop: 8 }]}>Set service cities, return warehouse details, and the bank and WhatsApp details shown during checkout.</Text>
      <Text style={[s.body, { marginTop: 14, marginBottom: 6 }]}>Operating cities</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, minHeight: 54, padding: 8, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated, borderRadius: 12 }}>
        {operatingCities.map((city) => (
          <View key={city} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 7, paddingLeft: 12, paddingRight: 6, backgroundColor: palette.accentSoft }}>
            <Text style={{ color: palette.text, fontWeight: "800" }}>{city}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${city}`} disabled={loading || saving} onPress={() => setOperatingCities((current) => current.filter((value) => value !== city))} style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: palette.danger, fontSize: 19, fontWeight: "900" }}>×</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          accessibilityLabel="Add an operating city"
          value={cityDraft}
          onChangeText={setCityDraft}
          onSubmitEditing={addCity}
          returnKeyType="done"
          editable={!loading && !saving}
          maxLength={100}
          placeholder="Type city, press Enter"
          placeholderTextColor={palette.muted}
          style={{ minWidth: 160, flexGrow: 1, paddingVertical: 8, paddingHorizontal: 5, color: palette.text, backgroundColor: "transparent" }}
        />
      </View>
      <Text style={[s.muted, { marginTop: 4 }]}>Press Enter to add each city. Customers can order only in these cities.</Text>
      {fields.map(([label, key, placeholder, maxLength]) => (
        <View key={key} style={{ marginTop: 12 }}>
          <Text style={[s.body, { marginBottom: 6 }]}>{label}</Text>
          <TextInput
            accessibilityLabel={label}
            value={profile[key] || ""}
            onChangeText={(value) => { setProfile({ ...profile, [key]: value }); setError(""); setNotice(""); }}
            editable={!loading && !saving} maxLength={maxLength}
            keyboardType={key.toLowerCase().includes("phone") || key.toLowerCase().includes("number") ? "phone-pad" : "default"}
            placeholder={placeholder} placeholderTextColor={palette.muted}
            style={[s.input, { color: palette.text, backgroundColor: palette.elevated, borderColor: palette.border }]}
          />
        </View>
      ))}
      <Button title={loading ? "Loading settings…" : saving ? "Saving settings…" : "Save store settings"} icon="check" disabled={loading || saving} onPress={saveSettings} />
      {(error || notice) && (
        <Modal transparent visible animationType="fade" statusBarTranslucent>
          <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end", padding: 18, paddingBottom: 34 }}>
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: error ? palette.danger : palette.success, backgroundColor: palette.surface, padding: 15, elevation: 10 }}>
              <Text accessibilityRole="alert" style={{ color: error ? palette.danger : palette.success, fontWeight: "800" }}>{error || notice}</Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default function AdminScreen({
  session,
  onSignOut,
  signingOut,
  sessionError,
  onPreviewStore,
  onUpdateUser,
  onPasswordChanged,
  security,
}) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const languageSettings = useMobileLanguage();
  themePalette = palette;
  setAdminPalette(palette);
  const [revision, setRevision] = useState(0);
  const [orders, setOrders] = useState(null);
  const [panel, setPanel] = useState("");
  const [module, setModule] = useState("");
  const overviewRef = useRef(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const dashboard = useAdminResource(
    session.accessToken,
    "/dashboard",
    revision,
  );
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (dashboard.data)
      setSnapshot({ token: session.accessToken, data: dashboard.data });
  }, [dashboard.data, session.accessToken]);
  const data =
    dashboard.data ||
    (snapshot?.token === session.accessToken ? snapshot.data : null);
  const refresh = () => setRevision((v) => v + 1);
  useEffect(() => {
    let timer;
    const updateTimer = (state) => {
      clearInterval(timer);
      if (state === "active") {
        setRevision((v) => v + 1);
        timer = setInterval(() => setRevision((v) => v + 1), 30000);
      }
    };
    updateTimer(AppState.currentState);
    const subscription = AppState.addEventListener("change", updateTimer);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  function signOut() {
    Alert.alert(
      "Sign out of admin?",
      "Your fingerprint preference stays saved on this phone. Your next admin sign-in still requires email OTP.",
      [
        { text: "Stay signed in", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: onSignOut },
      ],
    );
  }
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: palette.background }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <View style={[s.header, s.dashboardHeader, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
        <View style={s.dashboardHeaderMain}>
          <IconButton
            icon="menu"
            label="Open admin sidebar"
            compact
            onPress={() => setSidebarOpen(true)}
          />
          <View style={s.grow}>
            <Text style={s.eyebrow}>SHOPMART ADMIN</Text>
            <Text numberOfLines={1} style={s.dashboardTitle}>Dashboard</Text>
          </View>
        </View>
        <View style={s.dashboardHeaderActions}>
          <NotificationBell
            session={session}
            style={s.compactNotificationBell}
            accentColor={palette.accent}
            surfaceColor={palette.surface}
            borderColor={palette.border}
            onPress={() => setPanel("notifications")}
          />
          <IconButton
            icon="user"
            label="Admin profile and security"
            compact
            onPress={() => setPanel("account")}
          />
        </View>
      </View>
      <ScrollView
        ref={overviewRef}
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, s.dashboardContent]}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.loading}
            onRefresh={refresh}
            tintColor={themePalette.accent}
          />
        }
      >
        <View style={s.dashboardWelcome}>
          <Text style={s.welcomeName}>
            Welcome back, {session.user.name?.split(" ")[0] || "Admin"}
          </Text>
          <Text style={s.welcomeCaption}>
            Your store's performance at a glance.
          </Text>
        </View>
        {sessionError ? (
          <Text accessibilityRole="alert" style={s.error}>
            {sessionError}
          </Text>
        ) : null}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Business overview</Text>
          <IconButton
            icon="refresh"
            label="Refresh dashboard"
            disabled={dashboard.loading}
            onPress={refresh}
          />
        </View>
        {dashboard.error ? (
          <ErrorMessage message={dashboard.error} onRetry={refresh} />
        ) : dashboard.loading && !data ? (
          <ActivityIndicator size="large" color={themePalette.accent} style={s.loader} />
        ) : (
          data && (
            <>
              <View style={s.revenue}>
                <View style={s.revenueTop}>
                  <View style={s.inline}>
                    <View style={s.revenueIcon}>
                      <Icon name="wallet" color={themePalette.accent} size={18} />
                    </View>
                    <Text style={s.revenueLabel}>NET REVENUE</Text>
                  </View>
                  <View style={s.periodBadge}>
                    <Text style={s.periodText}>ALL TIME</Text>
                  </View>
                </View>
                <Text style={s.revenueAmount}>
                  {money(data.paidRevenue, data.currency)}
                </Text>
                <View style={s.revenueDivider} />
                <View style={s.revenueStats}>
                  <View style={s.revenueStat}>
                    <Text style={s.revenueStatLabel}>Gross paid</Text>
                    <Text style={s.revenueStatValue}>
                      {money(data.grossPaidRevenue, data.currency)}
                    </Text>
                  </View>
                  <View style={s.revenueStat}>
                    <Text style={s.revenueStatLabel}>Refunds recorded</Text>
                    <Text style={s.revenueStatValue}>
                      -{money(data.refundedAmount, data.currency)}
                    </Text>
                  </View>
                </View>
                <Text style={s.revenueCaption}>
                  Includes verified Safepay sandbox payments.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Review pending COD handovers"
                onPress={() => setModule("cash")}
                style={s.cashAlert}
              >
                <Icon name="wallet" color={themePalette.warning} />
                <View style={s.grow}>
                  <Text style={s.cardTitle}>
                    {data.pendingCodHandovers || 0} COD handovers awaiting
                    review
                  </Text>
                  <Text style={s.body}>
                    {money(data.pendingCodAmount, data.currency)} reported by
                    riders
                    {"\n"}Total COD awaiting confirmed receipt:{" "}
                    {money(data.codWithRiders, data.currency)}
                  </Text>
                  <Text style={s.muted}>
                    Open to check and confirm physical cash. Handover does not
                    add revenue twice.
                  </Text>
                </View>
                <Icon name="arrow" />
              </Pressable>
              <View style={s.metrics}>
                {[
                  {
                    label: "Total orders",
                    value: data.totalOrders,
                    icon: "box",
                    color: themePalette.accentSoft,
                    action: () => setOrders({}),
                  },
                  {
                    label: "Pending orders",
                    value: data.pendingOrders,
                    icon: "clock",
                  color: themePalette.warningSoft,
                    action: () => setOrders({ initialStatus: "PENDING" }),
                  },
                  {
                    label: "Active products",
                    value: data.activeProducts,
                    icon: "grid",
                    color: themePalette.successSoft,
                  },
                  {
                    label: "Active customers",
                    value: data.activeCustomers,
                    icon: "user",
                    color: themePalette.accentSoft,
                  },
                ].map((item) => (
                  <View key={item.label} style={s.metric}>
                    <View
                      style={[s.metricIcon, { backgroundColor: item.color }]}
                    >
                      <Icon name={item.icon} />
                    </View>
                    <Text style={s.metricNumber}>{item.value}</Text>
                    <Text style={s.metricLabel}>{item.label}</Text>
                    {item.action && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`View ${item.label.toLowerCase()}`}
                        onPress={item.action}
                        style={s.metricAction}
                      >
                        <Text style={s.link}>View orders</Text>
                        <Icon name="arrow" size={14} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
              <View style={s.riderSummary}>
                <View style={s.riderIcon}>
                  <Icon name="truck" color={themePalette.accent} />
                </View>
                <View style={s.grow}>
                  <Text style={s.cardTitle}>Rider team</Text>
                  <Text style={s.muted}>
                    Assign riders from confirmed order details.
                  </Text>
                </View>
                <View style={s.riderCount}>
                  <Text style={s.riderCountText}>{data.activeRiders}</Text>
                  <Text style={s.riderCountLabel}>ACTIVE</Text>
                </View>
              </View>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Latest orders</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOrders({})}
                  style={s.textButton}
                >
                  <Text style={s.link}>View all</Text>
                  <Icon name="arrow" size={15} />
                </Pressable>
              </View>
              {data.recentOrders.length ? (
                data.recentOrders
                  .slice(0, 4)
                  .map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onPress={() => setOrders({ initialId: order.id })}
                    />
                  ))
              ) : (
                <View style={s.card}>
                  <Text style={s.body}>
                    New customer orders will appear here.
                  </Text>
                </View>
              )}
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Stock attention</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setLowStockOnly(true);
                    setModule("products");
                  }}
                  style={s.textButton}
                >
                  <Text style={s.link}>View all</Text>
                  <Icon name="arrow" size={15} />
                </Pressable>
              </View>
              <View style={s.card}>
                {data.lowStockProducts.length ? (
                  data.lowStockProducts.slice(0, 4).map((product) => (
                    <View key={product.id} style={s.itemRow}>
                      <View style={s.grow}>
                        <Text style={s.itemName}>{product.name}</Text>
                        <Text style={s.muted}>
                          {product.stock === 0
                            ? "Restock required"
                            : "Running low"}
                        </Text>
                      </View>
                      <View
                        style={[s.stockBadge, product.stock === 0 && s.danger]}
                      >
                        <Text style={s.dangerText}>
                          {product.stock === 0
                            ? "Out of stock"
                            : `${product.stock} left`}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={s.body}>
                    No active products currently need stock attention.
                  </Text>
                )}
              </View>
            </>
          )
        )}
      </ScrollView>
      {sidebarOpen && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSidebarOpen(false)}
        >
          <SafeAreaView style={s.drawerOverlay}>
            <View style={s.drawer}>
              <View style={s.drawerHeader}>
                <View style={s.grow}>
                  <Text style={s.drawerBrand}>
                    Shop<Text style={{ color: themePalette.accent }}>Mart</Text>
                  </Text>
                  <Text style={s.eyebrow}>ADMIN WORKSPACE</Text>
                </View>
                <IconButton
                  icon="close"
                  label="Close admin sidebar"
                  onPress={() => setSidebarOpen(false)}
                />
              </View>
              <View style={s.drawerIdentity}>
                <View style={s.drawerAvatar}>
                  <Text style={s.drawerInitial}>
                    {session.user.name?.charAt(0).toUpperCase() || "A"}
                  </Text>
                </View>
                <View style={s.grow}>
                  <Text style={s.drawerName}>{session.user.name}</Text>
                  <Text style={s.welcomeCaption}>Administrator</Text>
                </View>
              </View>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.drawerItems}
                showsVerticalScrollIndicator={false}
              >
                <Text style={s.drawerSection}>WORKSPACE</Text>
                {[
                  {
                    icon: "home",
                    label: "Dashboard",
                    selected: !orders && !module && !panel,
                    action: () =>
                      overviewRef.current?.scrollTo({ y: 0, animated: true }),
                  },
                  {
                    icon: "receipt",
                    label: "Orders",
                    selected: Boolean(orders),
                    action: () => setOrders({}),
                    count: data?.pendingOrders,
                  },
                  {
                    icon: "box",
                    label: "Products",
                    selected: module === "products",
                    action: () => {
                      setLowStockOnly(false);
                      setModule("products");
                    },
                  },
                  {
                    icon: "ticket",
                    label: "Vouchers & discounts",
                    selected: module === "vouchers",
                    action: () => setModule("vouchers"),
                  },
                  {
                    icon: "categories",
                    label: "Categories",
                    selected: module === "categories",
                    action: () => setModule("categories"),
                  },
                  {
                    icon: "people",
                    label: "Users & riders",
                    selected: module === "people",
                    action: () => setModule("people"),
                  },
                  {
                    icon: "truck",
                    label: "Deliveries & warehouse",
                    selected: module === "deliveries",
                    action: () => setModule("deliveries"),
                  },
                  { icon: "box", label: "Preview store", selected: false, action: () => onPreviewStore?.() },
                  {
                    icon: "returns",
                    label: "Returns & refunds",
                    count: data?.pendingReturnRequests,
                    selected: module === "returns",
                    action: () => setModule("returns"),
                  },
                  {
                    icon: "star",
                    label: "Reviews",
                    selected: module === "reviews",
                    action: () => setModule("reviews"),
                  },
                  {
                    icon: "wallet",
                    label: `COD cash handovers${data?.pendingCodHandovers ? ` (${data.pendingCodHandovers})` : ""}`,
                    selected: module === "cash",
                    action: () => setModule("cash"),
                  },
                ].map((item) => (
                  <Pressable
                    key={item.label}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: item.selected }}
                    onPress={() => {
                      setSidebarOpen(false);
                      item.action();
                    }}
                    style={({ pressed }) => [
                      s.drawerItem,
                      item.selected && s.drawerItemActive,
                      pressed && s.dim,
                    ]}
                  >
                    <Icon
                      name={item.icon}
                      size={21}
                      color={item.selected ? themePalette.accent : themePalette.muted}
                    />
                    <Text
                      style={[
                        s.drawerItemText,
                        item.selected && s.drawerItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.count > 0 && (
                      <View style={s.drawerCount}>
                        <Text style={s.drawerCountText}>
                          {item.count > 99 ? "99+" : item.count}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
                <Text style={[s.drawerSection, { marginTop: 22 }]}>
                  ACCOUNT
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSidebarOpen(false);
                    setPanel("account");
                  }}
                  style={s.drawerItem}
                >
                  <Icon name="user" color={themePalette.muted} />
                  <Text style={s.drawerItemText}>My profile & security</Text>
                  <Icon name="arrow" size={15} color={themePalette.muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSidebarOpen(false);
                    setPanel("store-details");
                  }}
                  style={s.drawerItem}
                >
                  <Icon name="home" color={themePalette.muted} />
                  <Text style={s.drawerItemText}>Store details</Text>
                  <Icon name="arrow" size={15} color={themePalette.muted} />
                </Pressable>
              </ScrollView>
              <View style={s.drawerFooter}>
                <Text style={s.welcomeCaption}>
                  Manage your store with confidence.
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss sidebar"
              style={s.drawerDismiss}
              onPress={() => setSidebarOpen(false)}
            />
          </SafeAreaView>
        </Modal>
      )}
      {module && (
        <AdminModule
          name={module}
          initialLowStock={lowStockOnly}
          session={session}
          onClose={() => setModule("")}
          onChanged={refresh}
          onOpenOrder={(id) => {
            setModule("");
            setOrders({ initialId: id });
          }}
        />
      )}
      {orders && (
        <OrdersModal
          session={session}
          initialId={orders.initialId}
          initialStatus={orders.initialStatus}
          onClose={() => setOrders(null)}
          onChanged={refresh}
        />
      )}
      {panel === "notifications" && (
        <NotificationsModal
          session={session}
          onClose={() => setPanel("")}
          onOpenOrder={(id) => {
            setPanel("");
            setOrders({ initialId: id });
          }}
        />
      )}
      {panel === "profile" && (
        <ProfileModal
          session={session}
          onSaved={onUpdateUser}
          onClose={() => setPanel("")}
        />
      )}
      {panel === "password" && (
        <ChangePasswordModal
          session={session}
          onClose={() => setPanel("")}
          onChanged={onPasswordChanged}
        />
      )}
      {panel === "security" && (
        <BiometricSettingsModal
          security={security}
          onClose={() => setPanel("")}
          onLock={() => {
            setPanel("");
            security.lockNow();
          }}
        />
      )}
      <AppearanceModal
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />
      {panel === "store-details" && (
        <Modal visible animationType="slide" onRequestClose={() => setPanel("")}>
          <SafeAreaView style={s.screen}>
            <View style={s.header}>
              <View style={s.grow}>
                <Text style={s.eyebrow}>SHOPMART ADMIN</Text>
                <Text style={s.title}>Store details</Text>
              </View>
              <IconButton icon="close" label="Close store details" onPress={() => setPanel("")} />
            </View>
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
              <WarehouseAddressSettings session={session} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
      {panel === "account" && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setPanel("")}
        >
          <SafeAreaView style={s.screen}>
            <View style={s.header}>
              <View style={s.grow}>
                <Text style={s.eyebrow}>SHOPMART ADMIN</Text>
                <Text style={s.title}>My account</Text>
              </View>
              <IconButton
                icon="close"
                label="Close admin account"
                onPress={() => setPanel("")}
              />
            </View>
            <ScrollView contentContainerStyle={s.content}>
              <View style={s.profileCard}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {session.user.name?.charAt(0).toUpperCase() || "A"}
                  </Text>
                </View>
                <Text style={s.profileName}>{session.user.name}</Text>
                <Text style={s.body}>{session.user.email}</Text>
                <View style={s.adminBadge}>
                  <Text style={s.link}>Administrator</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => languageSettings.setLanguage(languageSettings.language === "en" ? "ur" : "en")}
                style={s.accountAction}
              >
                <View style={s.metricIcon}><Icon name="languages" /></View>
                <View style={s.grow}>
                  <Text style={s.cardTitle}>App language</Text>
                  <Text style={s.muted}>ShopMart language · {languageSettings.language === "ur" ? "اردو" : "English"}</Text>
                </View>
                <Text style={s.link}>{languageSettings.language === "ur" ? "English" : "اردو"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAppearanceOpen(true)}
                style={s.accountAction}
              >
                <View style={s.metricIcon}><Icon name="palette" /></View>
                <View style={s.grow}>
                  <Text style={s.cardTitle}>Appearance</Text>
                  <Text style={s.muted}>Change theme and accent colour</Text>
                </View>
                <Icon name="arrow" />
              </Pressable>
              {[
                {
                  icon: "user",
                  title: "Edit profile",
                  description: "Update your name and phone number",
                  action: () => setPanel("profile"),
                },
                {
                  icon: "lock",
                  title: "Change password",
                  description: "Secure your administrator account",
                  action: () => setPanel("password"),
                },
                {
                  icon: "lock",
                  title: "Fingerprint & security",
                  description: security.enabled
                    ? "Biometric unlock is enabled"
                    : "Manage biometric app unlock",
                  action: () => setPanel("security"),
                },
                {
                  icon: "logout",
                  title: signingOut ? "Signing out..." : "Sign out",
                  description: "End this session on this device",
                  action: signOut,
                },
              ].map((item) => (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  disabled={signingOut}
                  onPress={item.action}
                  style={[s.accountAction, signingOut && s.dim]}
                >
                  <View style={s.metricIcon}>
                    <Icon name={item.icon} />
                  </View>
                  <View style={s.grow}>
                    <Text style={s.cardTitle}>{item.title}</Text>
                    <Text style={s.muted}>{item.description}</Text>
                  </View>
                  <Icon name="arrow" size={16} />
                </Pressable>
              ))}
              {sessionError ? (
                <Text accessibilityRole="alert" style={s.error}>
                  {sessionError}
                </Text>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const baseS = StyleSheet.create({
  cashAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: "#fff6e2",
    borderColor: "#f1dfb5",
    borderWidth: 1,
  },
  dashboardWelcome: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 3,
  },
  welcomeName: { color: "#493451", fontSize: 16, fontWeight: "700" },
  welcomeCaption: {
    color: "#9a86a8",
    fontSize: 10,
    lineHeight: 18,
    marginTop: 4,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(25, 17, 42, 0.42)",
  },
  drawer: {
    width: "84%",
    maxWidth: 330,
    backgroundColor: "#fcfaff",
    borderTopRightRadius: 25,
    borderBottomRightRadius: 25,
    overflow: "hidden",
  },
  drawerDismiss: { flex: 1 },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  drawerBrand: {
    fontSize: 28,
    color: "#33223f",
    fontWeight: "900",
    letterSpacing: -1,
  },
  drawerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    marginHorizontal: 16,
    backgroundColor: "#efe7fa",
    borderRadius: 18,
    marginBottom: 18,
  },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#dfcef4",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerInitial: { fontSize: 20, color: "#7c3aed", fontWeight: "800" },
  drawerName: { fontSize: 13, color: "#50355f", fontWeight: "800" },
  drawerItems: { paddingHorizontal: 13, paddingBottom: 18 },
  drawerSection: {
    fontSize: 8,
    color: "#ac96ba",
    fontWeight: "800",
    letterSpacing: 1.4,
    marginLeft: 14,
    marginBottom: 9,
  },
  drawerItem: {
    minHeight: 49,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  drawerItemActive: { backgroundColor: "#eee3fc" },
  drawerItemText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#7c628e",
  },
  drawerItemTextActive: { color: "#7c3aed", fontWeight: "800" },
  drawerCount: {
    minWidth: 23,
    height: 23,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerCountText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  drawerFooter: { padding: 17, borderTopWidth: 1, borderTopColor: "#ede5f4" },
  screen: { flex: 1, backgroundColor: "#faf9fd" },
  grow: { flex: 1, minWidth: 0 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dashboardHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    borderBottomWidth: 1,
  },
  dashboardHeaderMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dashboardHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  dashboardTitle: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "800",
    color: "#29213b",
    marginTop: 2,
    letterSpacing: -0.35,
  },
  dashboardContent: { paddingTop: 18 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#8e7da7",
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#29213b",
    marginTop: 5,
    letterSpacing: -0.7,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f0eafa",
    alignItems: "center",
    justifyContent: "center",
  },
  compactIconButton: { width: 40, height: 40, borderRadius: 13 },
  compactNotificationBell: { width: 40, height: 40, borderRadius: 13 },
  content: { paddingHorizontal: 20, paddingBottom: 35 },
  hero: {
    backgroundColor: "#eee5fb",
    borderRadius: 24,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e3d6f7",
    marginBottom: 8,
  },
  heroEyebrow: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#8a70ab",
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#3b2853",
    marginTop: 13,
  },
  heroBody: { fontSize: 12, color: "#806c99", marginTop: 8 },
  heroIcon: {
    width: 63,
    height: 70,
    backgroundColor: "#e0d1f5",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 22,
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#25344c" },
  revenue: {
    padding: 19,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
  },
  revenueTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  revenueIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  revenueLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  periodBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  periodText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  revenueAmount: {
    fontWeight: "800",
    fontSize: 28,
    marginTop: 13,
    letterSpacing: -0.7,
  },
  revenueDivider: { height: 1, marginTop: 14, marginBottom: 10 },
  revenueStats: { flexDirection: "row", gap: 12 },
  revenueStat: { flex: 1, minWidth: 0 },
  revenueStatLabel: { fontSize: 9, fontWeight: "600" },
  revenueStatValue: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  revenueCaption: {
    fontSize: 9,
    lineHeight: 15,
    marginTop: 10,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 9 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  metric: {
    width: "48%",
    minHeight: 174,
    padding: 15,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eae3f2",
  },
  metricIcon: {
    width: 42,
    height: 42,
    backgroundColor: "#f0eafa",
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  metricNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#3a2c4b",
    marginTop: 13,
  },
  metricLabel: { fontSize: 11, color: "#887a9b", marginTop: 4 },
  metricAction: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 4,
    marginTop: 4,
  },
  riderSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 2,
  },
  riderIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  riderCount: { minWidth: 54, alignItems: "center", paddingVertical: 7, paddingHorizontal: 9, borderRadius: 13 },
  riderCountText: { fontSize: 17, fontWeight: "800" },
  riderCountLabel: { fontSize: 7, fontWeight: "800", letterSpacing: 0.7, marginTop: 2 },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 15,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 13,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  secondary: { backgroundColor: "#f0eafa" },
  danger: { backgroundColor: "#fff0f3" },
  dangerText: { color: "#be3153", fontSize: 11, fontWeight: "700" },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  textButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
  },
  orderCard: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#eae3f2",
    marginBottom: 12,
  },
  orderNumber: {
    color: "#8d7ba5",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 17,
  },
  customer: { color: "#40314f", fontSize: 16, fontWeight: "700", marginTop: 8 },
  status: { borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9 },
  statusText: { fontSize: 9, fontWeight: "700" },
  cardFoot: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0ebf5",
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7c3aed",
    maxWidth: "48%",
  },
  muted: { color: "#887a9b", fontSize: 10, lineHeight: 18, marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eae3f2",
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#443151" },
  body: { fontSize: 12, color: "#7e6c90", lineHeight: 21, marginTop: 6 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f1ecf6",
  },
  itemName: {
    color: "#5b456b",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  stockBadge: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#fff5de",
    borderRadius: 9,
  },
  loader: { marginVertical: 35 },
  errorBox: { padding: 18 },
  error: { color: "#be3153", fontSize: 12, lineHeight: 21, marginVertical: 10 },
  success: { color: "#20764a", fontSize: 12, lineHeight: 21, marginBottom: 12 },
  empty: { paddingVertical: 45, alignItems: "center", gap: 12 },
  filters: { paddingHorizontal: 20, paddingBottom: 15 },
  search: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eae3f2",
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: "#443151",
    fontSize: 13,
    padding: 12,
  },
  chips: { paddingVertical: 13, gap: 8 },
  chip: {
    backgroundColor: "#eee9f6",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 44,
  },
  chipActive: { backgroundColor: "#7c3aed" },
  chipText: { color: "#88759c", fontSize: 11, fontWeight: "600" },
  white: { color: "#fff" },
  orderList: { paddingHorizontal: 20, paddingBottom: 20 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eae3f2",
  },
  total: { fontSize: 30, color: "#7c3aed", fontWeight: "800", marginTop: 18 },
  quantityBadge: { backgroundColor: "#f0eafa", borderRadius: 10, padding: 10 },
  riderChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: "#eae3f2",
    backgroundColor: "#faf9fd",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    marginTop: 10,
  },
  riderSelected: { borderColor: "#a477ee", backgroundColor: "#f1e9ff" },
  riderSelect: { justifyContent: "space-between" },
  riderPickerMenu: {
    marginTop: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eae3f2",
    backgroundColor: "#faf9fd",
  },
  riderSearch: {
    borderWidth: 1,
    borderColor: "#eae3f2",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 10,
    color: "#25304a",
  },
  radio: {
    width: 19,
    height: 19,
    borderWidth: 1,
    borderColor: "#bcabc9",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#7c3aed", backgroundColor: "#7c3aed" },
  info: {
    padding: 17,
    backgroundColor: "#f0eafa",
    borderRadius: 17,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  dim: { opacity: 0.5 },
  profileCard: {
    padding: 25,
    backgroundColor: "#f0eafa",
    alignItems: "center",
    borderRadius: 23,
    marginBottom: 24,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: "#e0d1f5",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#7c3aed", fontSize: 30, fontWeight: "800" },
  profileName: {
    color: "#443151",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 15,
    textAlign: "center",
  },
  adminBadge: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#e5d8f8",
    marginTop: 14,
  },
  accountAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eae3f2",
    padding: 15,
    borderRadius: 17,
    marginBottom: 12,
  },
});

const screenStyles = {
  screen: (c) => ({ backgroundColor: c.background }),
  header: (c) => ({ backgroundColor: c.surface, borderBottomColor: c.border }),
  dashboardTitle: (c) => ({ color: c.text }),
  drawerOverlay: (c) => ({ backgroundColor: c.background }),
  drawer: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  drawerHeader: (c) => ({ borderBottomColor: c.border }),
  drawerFooter: (c) => ({ borderTopColor: c.border }),
  drawerIdentity: (c) => ({ backgroundColor: c.accentSoft }),
  drawerAvatar: (c) => ({ backgroundColor: c.soft }),
  drawerInitial: (c) => ({ color: c.accent }),
  drawerItem: (c) => ({ borderColor: c.border }),
  drawerCountText: () => ({ color: "#fff" }),
  drawerDismiss: (c) => ({ backgroundColor: c.background }),
  card: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  orderCard: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  metric: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  metricIcon: (c) => ({ backgroundColor: c.soft }),
  metricNumber: (c) => ({ color: c.text }),
  profileCard: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  avatar: (c) => ({ backgroundColor: c.soft, borderColor: c.surface }),
  avatarText: (c) => ({ color: c.accent }),
  adminBadge: (c) => ({ backgroundColor: c.accentSoft }),
  accountAction: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  dashboardWelcome: (c) => ({ backgroundColor: c.accentSoft, borderColor: c.border }),
  hero: (c) => ({ backgroundColor: c.accentSoft, borderColor: c.border }),
  heroIcon: (c) => ({ backgroundColor: c.soft }),
  heroEyebrow: (c) => ({ color: c.accent }),
  heroTitle: (c) => ({ color: c.text }),
  heroBody: (c) => ({ color: c.muted }),
  cashAlert: (c) => ({ backgroundColor: c.warningSoft || c.accentSoft, borderColor: c.border }),
  revenue: (c) => ({ backgroundColor: c.accentSoft, borderColor: c.border }),
  revenueIcon: (c) => ({ backgroundColor: c.surface }),
  periodBadge: (c) => ({ backgroundColor: c.surface }),
  periodText: (c) => ({ color: c.muted }),
  revenueDivider: (c) => ({ backgroundColor: c.border }),
  revenueLabel: (c) => ({ color: c.muted }),
  revenueAmount: (c) => ({ color: c.accent }),
  revenueStatLabel: (c) => ({ color: c.muted }),
  revenueStatValue: (c) => ({ color: c.text }),
  revenueCaption: (c) => ({ color: c.muted }),
  riderSummary: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  riderIcon: (c) => ({ backgroundColor: c.accentSoft }),
  riderCount: (c) => ({ backgroundColor: c.soft }),
  riderCountText: (c) => ({ color: c.accent }),
  riderCountLabel: (c) => ({ color: c.muted }),
  drawerItemActive: (c) => ({ backgroundColor: c.accentSoft }),
  drawerItemText: (c) => ({ color: c.muted }),
  drawerItemTextActive: (c) => ({ color: c.accent }),
  screenText: (c) => ({ color: c.text }),
  title: (c) => ({ color: c.text }),
  welcomeName: (c) => ({ color: c.text }),
  sectionTitle: (c) => ({ color: c.text }),
  cardTitle: (c) => ({ color: c.text }),
  customer: (c) => ({ color: c.text }),
  profileName: (c) => ({ color: c.text }),
  drawerName: (c) => ({ color: c.text }),
  body: (c) => ({ color: c.text }),
  muted: (c) => ({ color: c.muted }),
  welcomeCaption: (c) => ({ color: c.muted }),
  eyebrow: (c) => ({ color: c.accent }),
  drawerBrand: (c) => ({ color: c.accent }),
  drawerSection: (c) => ({ color: c.muted }),
  orderNumber: (c) => ({ color: c.muted }),
  metricLabel: (c) => ({ color: c.muted }),
  orderAmount: (c) => ({ color: c.accent }),
  itemName: (c) => ({ color: c.text }),
  stockBadge: (c) => ({ backgroundColor: c.warning === "#fbbf24" ? "#3b3020" : "#fff5de" }),
  link: (c) => ({ color: c.accent }),
  drawerCount: (c) => ({ backgroundColor: c.accent }),
  iconButton: (c) => ({ backgroundColor: c.soft }),
  secondary: (c) => ({ backgroundColor: c.accentSoft }),
  button: (c) => ({ backgroundColor: c.accent }),
  danger: (c) => ({ backgroundColor: c.dangerSoft }),
  dangerText: (c) => ({ color: c.danger }),
  error: (c) => ({ color: c.danger }),
  errorBox: (c) => ({ backgroundColor: c.dangerSoft, borderColor: c.border }),
  success: (c) => ({ color: c.success }),
  input: (c) => ({ backgroundColor: c.elevated, borderColor: c.border, color: c.text }),
  search: (c) => ({ backgroundColor: c.surface, borderColor: c.border, color: c.text }),
  riderSearch: (c) => ({ backgroundColor: c.surface, borderColor: c.border, color: c.text }),
  riderChoice: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  riderSelected: (c) => ({ backgroundColor: c.accentSoft, borderColor: c.accent }),
  riderPickerMenu: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  chip: (c) => ({ backgroundColor: c.soft, borderColor: c.border }),
  chipActive: (c) => ({ backgroundColor: c.accentSoft, borderColor: c.accent }),
  chipText: (c) => ({ color: c.text }),
  pagination: (c) => ({ backgroundColor: c.background }),
  cardFoot: (c) => ({ borderTopColor: c.border }),
};

const s = new Proxy(baseS, {
  get(target, property) {
    const style = Reflect.get(target, property);
    const override = screenStyles[property];
    return override ? [style, override(themePalette)] : style;
  },
});
