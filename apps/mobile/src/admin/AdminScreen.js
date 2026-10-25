import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
import NotificationsModal from "../notifications/NotificationsModal";
import ProfileModal from "../account/ProfileModal";
import ChangePasswordModal from "../account/ChangePasswordModal";
import BiometricSettingsModal from "../account/BiometricSecurity";

const paths = {
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
  back: "m15 5-7 7 7 7",
  close: "m6 6 12 12M6 18 18 6",
  wallet: "M3 5h16v15H3V5Zm0 0 13-3v3m-1 5h6v6h-6v-6m3 3h.01",
  check: "m5 12 4 4L19 6",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
};
function Icon({ name, size = 21, color = "#7c3aed" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function IconButton({ icon, label, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[s.iconButton, disabled && s.dim]}
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
          color={danger ? "#be3153" : secondary ? "#7c3aed" : "#fff"}
        />
      )}
      <Text style={[s.buttonText, secondary && s.link, danger && s.dangerText]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Status({ value }) {
  const tone =
    value === "DELIVERED"
      ? { bg: "#e5f5ec", fg: "#20764a" }
      : value === "CANCELLED"
        ? { bg: "#fff0f3", fg: "#be3153" }
        : value === "PENDING"
          ? { bg: "#fff5de", fg: "#94600b" }
          : { bg: "#f0eafa", fg: "#7c3aed" };
  return (
    <View style={[s.status, { backgroundColor: tone.bg }]}>
      <Text style={[s.statusText, { color: tone.fg }]}>{readable(value)}</Text>
    </View>
  );
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
              {order.paymentMethod === "COD"
                ? "Cash on delivery"
                : readable(order.paymentMethod)}{" "}
              · {readable(order.paymentStatus)}
            </Text>
          )}
        </View>
        <Text style={s.orderAmount}>{money(order.total, order.currency)}</Text>
        <Icon name="arrow" size={16} color="#a996c2" />
      </View>
    </Pressable>
  );
}

function OrderDetails({ session, orderId, onBack, onChanged, onBusyChanged }) {
  const [revision, setRevision] = useState(0);
  const [riderId, setRiderId] = useState("");
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
  const loading = detail.loading || assignment.loading;
  const canDispatch =
    assignment.data?.delivery.riderId && assignment.data.delivery.riderEnabled;
  const locked =
    busy || uncertain || loading || Boolean(detail.error || assignment.error);
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
            <ActivityIndicator color="#7c3aed" />
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
          <ActivityIndicator size="large" color="#7c3aed" style={s.loader} />
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
                <Text style={s.muted}>
                  {order.paymentMethod === "COD"
                    ? "Cash on delivery"
                    : readable(order.paymentMethod)}{" "}
                  · {readable(order.paymentStatus)}
                </Text>
                <Text style={s.muted}>{dateLabel(order.createdAt)}</Text>
              </View>
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
                    {order.status === "CONFIRMED" ? (
                      <>
                        <Text style={s.muted}>
                          Choose an active rider before dispatching.
                        </Text>
                        {assignment.data?.riders.length ? (
                          assignment.data.riders.map((rider) => (
                            <Pressable
                              key={rider.id}
                              accessibilityRole="radio"
                              accessibilityState={{
                                checked: riderId === rider.id,
                              }}
                              disabled={locked}
                              onPress={() => setRiderId(rider.id)}
                              style={[
                                s.riderChoice,
                                riderId === rider.id && s.riderSelected,
                              ]}
                            >
                              <View
                                style={[
                                  s.radio,
                                  riderId === rider.id && s.radioSelected,
                                ]}
                              >
                                {riderId === rider.id && (
                                  <Icon name="check" size={12} color="#fff" />
                                )}
                              </View>
                              <Text style={[s.body, s.grow]}>{rider.name}</Text>
                            </Pressable>
                          ))
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
                          : "Rider changes are managed through the delivery and warehouse workflow after dispatch."}
                      </Text>
                    )}
                  </>
                )}
              </View>
              {(order.status === "PENDING" || order.status === "CONFIRMED") && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Order actions</Text>
                  {order.status === "PENDING" && (
                    <Button
                      title="Confirm order"
                      icon="check"
                      disabled={locked}
                      onPress={() => changeStatus("CONFIRMED")}
                    />
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
                  <Button
                    title="Cancel order"
                    icon="close"
                    danger
                    disabled={locked}
                    onPress={() => changeStatus("CANCELLED")}
                  />
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
    `/orders?page=${page}&size=15`,
    revision,
  );
  const query = search.trim().toLowerCase();
  const items = (result.data?.items || []).filter(
    (order) =>
      (status === "ALL" || status === order.status) &&
      `${order.orderNumber} ${order.customerName}`
        .toLowerCase()
        .includes(query),
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
                <Icon name="search" size={19} color="#9a8eab" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  accessibilityLabel="Search orders on this page"
                  placeholder="Search this page"
                  placeholderTextColor="#9a8eab"
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
                Search and status filters apply to this page.{" "}
                {result.data
                  ? `${result.data.totalItems} orders in total.`
                  : ""}
              </Text>
            </View>
            {result.loading ? (
              <ActivityIndicator
                size="large"
                color="#7c3aed"
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
                      Try another filter or another page.
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

export default function AdminScreen({
  session,
  onSignOut,
  signingOut,
  sessionError,
  onUpdateUser,
  onPasswordChanged,
  security,
}) {
  const [revision, setRevision] = useState(0);
  const [orders, setOrders] = useState(null);
  const [panel, setPanel] = useState("");
  const dashboard = useAdminResource(
    session.accessToken,
    "/dashboard",
    revision,
  );
  const data = dashboard.data;
  const refresh = () => setRevision((v) => v + 1);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setRevision((v) => v + 1);
    });
    return () => subscription.remove();
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
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>SHOPMART ADMIN</Text>
          <Text style={s.title}>Store overview</Text>
        </View>
        <IconButton
          icon="bell"
          label="Admin notifications"
          onPress={() => setPanel("notifications")}
        />
        <IconButton
          icon="user"
          label="Admin profile and security"
          onPress={() => setPanel("account")}
        />
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.loading}
            onRefresh={refresh}
            tintColor="#7c3aed"
          />
        }
      >
        <View style={s.hero}>
          <View style={s.grow}>
            <Text style={s.heroEyebrow}>YOUR STORE, AT A GLANCE</Text>
            <Text style={s.heroTitle}>
              Hi, {session.user.name?.split(" ")[0] || "Admin"}
            </Text>
            <Text style={s.heroBody}>Keep every order moving.</Text>
          </View>
          <View style={s.heroIcon}>
            <Icon name="grid" size={32} />
          </View>
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
        ) : dashboard.loading ? (
          <ActivityIndicator size="large" color="#7c3aed" style={s.loader} />
        ) : (
          data && (
            <>
              <View style={s.revenue}>
                <View style={s.inline}>
                  <Icon name="wallet" color="#ded1ff" />
                  <Text style={s.revenueLabel}>Net paid revenue</Text>
                </View>
                <Text style={s.revenueAmount}>
                  {money(data.paidRevenue, data.currency)}
                </Text>
                <Text style={s.revenueCaption}>
                  All time · after recorded refunds · excludes demo payments
                </Text>
              </View>
              <View style={s.metrics}>
                {[
                  {
                    label: "Total orders",
                    value: data.totalOrders,
                    icon: "box",
                    color: "#f1eafb",
                    action: () => setOrders({}),
                  },
                  {
                    label: "Pending orders",
                    value: data.pendingOrders,
                    icon: "clock",
                    color: "#fff3d9",
                    action: () => setOrders({ initialStatus: "PENDING" }),
                  },
                  {
                    label: "Active products",
                    value: data.activeProducts,
                    icon: "grid",
                    color: "#e6f3eb",
                  },
                  {
                    label: "Active customers",
                    value: data.activeCustomers,
                    icon: "user",
                    color: "#eaf0fc",
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
                <View style={s.inline}>
                  <Icon name="truck" />
                  <View style={s.grow}>
                    <Text style={s.cardTitle}>
                      {data.activeRiders} active riders
                    </Text>
                    <Text style={s.muted}>
                      Assign a rider from confirmed order details.
                    </Text>
                  </View>
                </View>
              </View>
              <Button
                title="Manage customer orders"
                icon="box"
                onPress={() => setOrders({})}
              />
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
                data.recentOrders.map((order) => (
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
                <Text style={s.muted}>5 or fewer left</Text>
              </View>
              <View style={s.card}>
                {data.lowStockProducts.length ? (
                  data.lowStockProducts.map((product) => (
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
        <NotificationsModal session={session} onClose={() => setPanel("")} />
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#faf9fd" },
  grow: { flex: 1, minWidth: 0 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#3a2c4b" },
  revenue: {
    padding: 22,
    backgroundColor: "#7137ca",
    borderRadius: 22,
    marginBottom: 15,
  },
  revenueLabel: { fontSize: 12, color: "#e6d9ff", fontWeight: "600" },
  revenueAmount: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 29,
    marginTop: 15,
    letterSpacing: -0.8,
  },
  revenueCaption: {
    fontSize: 10,
    color: "#e4d4ff",
    lineHeight: 17,
    marginTop: 8,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 9 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 13,
  },
  metric: {
    width: "47%",
    padding: 17,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eae3f2",
  },
  metricIcon: {
    width: 43,
    height: 43,
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
    padding: 16,
    borderRadius: 17,
    backgroundColor: "#f0edf8",
    marginTop: 15,
  },
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
