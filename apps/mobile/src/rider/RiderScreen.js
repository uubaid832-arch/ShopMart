import { Text } from "../i18n/LocalizedNativeComponents.js";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text as NativeText, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import RiderProfile from "./RiderProfile";
import RiderDashboard from "./RiderDashboard";
import CodHandoverModal from "./CodHandoverModal";
import WarehouseReturnModal from "./WarehouseReturnModal";
import { useRiderLocation } from "./useRiderLocation";
import DeliveryFailureModal from "./DeliveryFailureModal";
import NotificationsModal from "../notifications/NotificationsModal";
import NotificationBell from "../notifications/NotificationBell";
import { useMobileAppearance } from "../appearance/MobileAppearance";
import AppearanceModal from "../appearance/AppearanceModal";
import { useMobileLanguage } from "../i18n/MobileLanguage";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
let riderPalette = null;
const readable = (value = "") => value.replace(/_/g, " ").toLowerCase();
const paths = {
  chat: "M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5Z",
  truck:
    "M2 5h12v12H2V5Zm12 4h4l4 5v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
  phone: "M7 3H3v4c0 8 6 14 14 14h4v-4l-5-2-2 2a12 12 0 0 1-7-7l2-2-2-5Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  palette: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a1.5 1.5 0 0 1 0-3h3a6 6 0 0 0 6-6c0-2.8-4-5-9-5ZM7.5 10h.01M10 6.5h.01M15 6.5h.01M17.5 10h.01",
};
function Icon({ name, color, size = 21 }) {
  const { theme } = useMobileAppearance();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color || theme.colors.accent}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

async function request(token, path = "", method = "GET", signal) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");
  const response = await fetch(
    `${baseUrl}/api/mobile/rider/deliveries${path}`,
    {
      method,
      credentials: "omit",
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );
  if (!response.ok) {
    const messages = {
      401: "Your session expired. Sign out and sign in again.",
      403: "Rider access is required.",
      404: "This delivery was not found or is no longer assigned to you.",
      409: "This action is unavailable at the current delivery stage. Refresh the list.",
    };
    throw new Error(
      messages[response.status] ||
        "Could not confirm the request. Refresh before trying again.",
    );
  }
  return response.status === 204 ? null : response.json();
}

export default function RiderScreen({
  session,
  onSignOut,
  signingOut,
  sessionError,
  onUpdateUser,
  onPasswordChanged,
  security,
}) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const languageSettings = useMobileLanguage();
  riderPalette = palette;
  const token = session.accessToken;
  const [view, setView] = useState("dashboard");
  const [cashOpen, setCashOpen] = useState(false);
  const [cashRevision, setCashRevision] = useState(0);
  const gps = useRiderLocation(session);
  const [section, setSection] = useState("ASSIGNED");
  const [warehouseDelivery, setWarehouseDelivery] = useState(null);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [failureDelivery, setFailureDelivery] = useState(null);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request(
      token,
      `?page=${page}&size=10&section=${section}`,
      "GET",
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(0, data.totalPages - 1);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        const sharing = data.items.find((item) => item.id === gps.orderId);
        if (sharing?.warehouseReturnPending) gps.stop();
        if (!controller.signal.aborted)
          setResult({ token, section, page, reload, data, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({
            token,
            section,
            page,
            reload,
            data: null,
            error: failure.message,
          });
      });
    return () => controller.abort();
  }, [token, section, page, reload]);

  const current =
    result?.token === token &&
    result?.section === section &&
    result?.page === page &&
    result?.reload === reload;
  const data = current ? result.data : null;

  async function openLink(url) {
    setError("");
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not open the phone or WhatsApp app.");
    }
  }

  function openWhatsApp(item) {
    let number = String(item.phone || "").replace(/\D/g, "");
    if (number.startsWith("00")) number = number.slice(2);
    if (/^03[0-9]{9}$/.test(number)) number = "92" + number.slice(1);
    if (!/^923[0-9]{9}$/.test(number)) {
      setError(
        "The customer's phone number must be a valid Pakistani mobile number for WhatsApp.",
      );
      return;
    }
    const text = `Assalam o Alaikum, I am your ShopMart rider for order ${item.orderNumber}. Please share your current location on WhatsApp so I can find your delivery address.`;
    openLink(`https://wa.me/${number}?text=${encodeURIComponent(text)}`);
  }

  async function complete(item) {
    if (item.warehouseReturnPending) {
      setError(
        "This parcel is in the warehouse return process. Wait for the administrator to arrange a retry.",
      );
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      if (gps.orderId === item.id) await gps.stop();
      await request(token, `/${encodeURIComponent(item.id)}/complete`, "PATCH");
      setNotice(`${item.orderNumber} marked as delivered.`);
      setCashRevision((v) => v + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setBusyId(null);
      setReload((value) => value + 1);
    }
  }

  function confirmDelivery(item) {
    if (pending.current || item.warehouseReturnPending) return;
    const amount = new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: item.currency || "PKR",
    }).format(Number(item.total));
    const bankPaid = item.paymentMethod === "BANK_TRANSFER" && item.paymentStatus === "PAID";
    Alert.alert(
      "Confirm successful delivery",
      item.paymentMethod === "COD"
        ? `Only confirm after handing over the parcel and collecting ${amount} in cash. This also marks the COD payment as paid.`
        : bankPaid
          ? "Only confirm after handing over the parcel. The bank transfer was already confirmed by the admin; do not collect cash."
          : "Only confirm after handing over the parcel. This does not collect real cash for a demo payment.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm delivered", onPress: () => complete(item) },
      ],
    );
  }

  function confirmSignOut() {
    Alert.alert(
      "Sign out?",
      "You will need to sign in again to access deliveries.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          onPress: async () => {
            await gps.stop(false);
            onSignOut();
          },
        },
      ],
    );
  }

  const topBar = (
    <View style={styles.header}>
      <View style={styles.grow}>
        <Text style={styles.eyebrow}>SHOPMART RIDER</Text>
        <Text style={styles.title}>
          {view === "dashboard"
            ? "Home"
            : view === "profile"
              ? "My account"
              : "Your deliveries"}
        </Text>
      </View>
      <NotificationBell
        session={session}
        onPress={() => setNotificationsOpen(true)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        disabled={Boolean(busyId) || signingOut}
        onPress={confirmSignOut}
        style={styles.iconButton}
      >
        {signingOut ? (
          <ActivityIndicator color={palette.accent} />
        ) : (
          <Icon name="logout" color={palette.muted} />
        )}
      </Pressable>
    </View>
  );

  const welcomeBanner = (
    <View style={styles.welcome}>
      <View style={styles.grow}>
        <Text style={styles.welcomeName}>
          Hi, {session.user.name?.split(" ")[0] || "Rider"}
        </Text>
        <Text style={styles.welcomeText}>
          {view === "deliveries"
            ? "Your delivery jobs are below."
            : "Your work, all in one place."}
        </Text>
      </View>
      <View style={styles.truck}>
        <Icon name="truck" size={35} />
      </View>
    </View>
  );

  const mainNavigation = (
    <View style={styles.viewTabs}>
      {[
        ["dashboard", "Home"],
        ["deliveries", "Deliveries"],
        ["profile", "My account"],
      ].map(([value, title]) => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityState={{ selected: view === value }}
          disabled={Boolean(busyId)}
          onPress={() => setView(value)}
          style={[styles.viewTab, view === value && styles.viewTabActive]}
        >
          <Text
            style={[
              styles.viewTabText,
              view === value && styles.activeTabText,
            ]}
          >
            {title}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  function renderDeliveryCard(item) {
    const delivered = item.status === "DELIVERED";
    const dispatched = item.status === "DISPATCHED";
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.grow}>
            <Text style={styles.cardEyebrow}>ORDER</Text>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
          </View>
          <Text style={[styles.status, delivered && styles.delivered, item.status === "RETURNED_TO_WAREHOUSE" && styles.returned]}>
            {delivered
              ? "Done"
              : item.status === "RETURNED_TO_WAREHOUSE"
                ? "Returned to warehouse"
                : item.status === "CANCELLED"
                  ? "Cancelled"
                : dispatched
                  ? "Ready to deliver"
                  : "Waiting for dispatch"}
          </Text>
        </View>

        <Text style={styles.customer}>{item.customerName || "Customer"}</Text>
        <View style={styles.addressRow}>
          <Icon name="pin" size={19} color={palette.accent} />
          <Text style={styles.address}>{item.address || "Address not available"}</Text>
        </View>

        <View style={styles.amountPanel}>
          <View style={styles.grow}>
            <Text style={styles.amountLabel}>Order amount</Text>
            <Text style={styles.payment}>
              {item.status === "RETURNED_TO_WAREHOUSE"
                ? "Parcel returned · no payment collected"
                : item.status === "DELIVERED"
                  ? item.paymentMethod === "COD"
                    ? "Cash collected by rider"
                    : "Paid order · no cash collected"
                  : item.paymentMethod === "BANK_TRANSFER" && item.paymentStatus === "PAID"
                    ? "Paid already · do not collect cash"
                    : item.paymentMethod === "COD"
                      ? "Cash to collect"
                      : "Paid already · do not collect cash"}
            </Text>
          </View>
          <Text style={styles.amount}>
            {new Intl.NumberFormat("en-PK", {
              style: "currency",
              currency: item.currency || "PKR",
              maximumFractionDigits: 0,
            }).format(Number(item.total))}
          </Text>
        </View>

        {!delivered && item.status !== "RETURNED_TO_WAREHOUSE" && <>
        <Text style={styles.stepLabel}>1 · CONTACT THE CUSTOMER</Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${item.customerName}`}
            onPress={() =>
              openLink(`tel:${String(item.phone || "").replace(/[^0-9+]/g, "")}`)
            }
            style={styles.secondary}
          >
            <Icon name="phone" size={19} />
            <Text style={styles.link}>Call</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.customerName} on WhatsApp`}
            onPress={() => openWhatsApp(item)}
            style={[styles.secondary, styles.whatsappButton]}
          >
            <Icon name="chat" size={19} color={palette.success} />
            <Text style={styles.whatsappText}>WhatsApp</Text>
          </Pressable>
        </View>
        </>}

        {dispatched && !item.warehouseReturnPending && (
          <>
            <Text style={styles.stepLabel}>2 · DELIVER THE ORDER</Text>
            <Pressable
              accessibilityRole="button"
              disabled={gps.busy || Boolean(busyId)}
              onPress={() =>
                gps.orderId === item.id ? gps.stop() : gps.start(item)
              }
              style={styles.gpsButton}
            >
              <Text style={styles.link}>
                {gps.busy
                  ? "Starting location…"
                  : gps.orderId === item.id
                    ? "Stop sharing location"
                    : gps.orderId
                      ? "Share location for this order"
                      : "Share my live location"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(busyId) || gps.busy}
              onPress={async () => {
                if (gps.orderId === item.id) await gps.stop();
                setFailureDelivery(item);
              }}
              style={styles.failureButton}
            >
              <Text style={styles.failureText}>Could not deliver</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(busyId) || item.warehouseReturnPending}
              onPress={() => confirmDelivery(item)}
              style={[styles.primary, (Boolean(busyId) || item.warehouseReturnPending) && styles.dim]}
            >
              <Text style={styles.white}>
                {busyId === item.id ? "Saving…" : "I delivered this order"}
              </Text>
            </Pressable>
          </>
        )}

        {item.lastAttempt && item.status !== "DELIVERED" && (item.status !== "RETURNED_TO_WAREHOUSE" || item.warehouseReturnPending) && (
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(busyId)}
            onPress={() => setWarehouseDelivery(item)}
            style={styles.warehouseButton}
          >
            <Text style={styles.warehouseText}>Parcel return status</Text>
          </Pressable>
        )}

        {!dispatched && !delivered && item.status !== "CANCELLED" && item.status !== "RETURNED_TO_WAREHOUSE" && (
          <Text style={styles.waitingNote}>
            Please wait. The shop will send this order to you before delivery.
          </Text>
        )}
        {item.warehouseReturnPending && (
          <Text style={styles.waitingNote}>
            Parcel is back at the shop. Wait for the shop to arrange the next step.
          </Text>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      {view === "deliveries" ? (
        <FlatList
          style={styles.deliveryList}
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.deliveryListContent}
          ListHeaderComponent={
            <>
              {topBar}
              {welcomeBanner}
              {mainNavigation}
              <View style={styles.section}>
                <View style={styles.grow}>
                  <Text style={styles.sectionTitle}>
                    {section === "ASSIGNED"
                      ? "To deliver"
                      : section === "DELIVERED"
                        ? "Delivered"
                        : "Returned to warehouse"}
                  </Text>
                  <Text style={styles.muted}>
                    {data ? `${data.totalItems} orders` : "Loading orders…"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh deliveries"
                  disabled={!current || Boolean(busyId)}
                  onPress={() => setReload((value) => value + 1)}
                  style={styles.refreshButton}
                >
                  {!current ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Icon name="refresh" color="#fff" />
                  )}
                  <Text style={styles.refreshText}>Refresh</Text>
                </Pressable>
              </View>
              <View style={styles.tabs}>
                {[
                  ["ASSIGNED", "To do"],
                  ["DELIVERED", "Done"],
                  ["FAILED", "Returned"],
                ].map(([value, title]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: section === value }}
                    disabled={Boolean(busyId)}
                    onPress={() => {
                      setSection(value);
                      setPage(0);
                      setError("");
                      setNotice("");
                    }}
                    style={[styles.tab, section === value && styles.activeTab]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        section === value && styles.activeTabText,
                      ]}
                    >
                      {title}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.locationBanner}>
                <Icon name="pin" size={18} color={palette.success} />
                <View style={styles.grow}>
                  <Text style={styles.locationTitle}>
                    {gps.orderId ? "Location is being shared" : "Location is off"}
                  </Text>
                  <Text style={styles.locationCopy}>
                    Turn it on from an order when the customer needs your location.
                  </Text>
                </View>
                {gps.orderId ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => gps.stop()}
                    style={styles.stopLocation}
                  >
                    <Text style={styles.stopLocationText}>Stop</Text>
                  </Pressable>
                ) : null}
              </View>
              {gps.message ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {gps.message}
                </Text>
              ) : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {error || sessionError ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error || sessionError}
                </Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            !current ? (
              <ActivityIndicator
                size="large"
              color={palette.accent}
                style={styles.loader}
              />
            ) : result?.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {result.error}
              </Text>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Icon name="truck" size={36} color={palette.accent} />
                </View>
                <Text style={styles.emptyTitle}>No orders here</Text>
                <Text style={styles.emptyCopy}>
                  New orders will show here when the shop assigns them to you.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => renderDeliveryCard(item)}
          ListFooterComponent={
            data?.totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  disabled={page === 0 || Boolean(busyId)}
                  onPress={() => setPage((value) => value - 1)}
                  style={[styles.pageButton, (page === 0 || Boolean(busyId)) && styles.disabledButton]}
                >
                  <Text style={styles.pageButtonText}>Previous</Text>
                </Pressable>
                <Text style={styles.pageCount}>
                  Page {page + 1} of {data.totalPages}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={page + 1 >= data.totalPages || Boolean(busyId)}
                  onPress={() => setPage((value) => value + 1)}
                  style={[styles.pageButton, (page + 1 >= data.totalPages || Boolean(busyId)) && styles.disabledButton]}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.listEndSpace} />
            )
          }
        />
      ) : (
        <>
          {topBar}
          {welcomeBanner}
          {mainNavigation}
          {view === "dashboard" && sessionError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {sessionError}
            </Text>
          ) : null}
          {view === "dashboard" && gps.orderId ? (
            <View style={styles.locationBanner}>
              <Icon name="pin" size={18} color={palette.success} />
              <Text style={[styles.locationTitle, styles.grow]}>
                Location sharing is on.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => gps.stop()}
                style={styles.stopLocation}
              >
                <Text style={styles.stopLocationText}>Stop</Text>
              </Pressable>
            </View>
          ) : null}
          {view === "dashboard" ? (
            <RiderDashboard
              session={session}
              revision={cashRevision}
              onOpenCash={() => setCashOpen(true)}
              onOpenDeliveries={() => setView("deliveries")}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => languageSettings.setLanguage(languageSettings.language === "en" ? "ur" : "en")}
                style={[styles.profileSetting, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <Text style={[styles.profileSettingTitle, { color: palette.text }]}>App language · {languageSettings.language === "ur" ? "اردو" : "English"}</Text>
                <Text style={[styles.profileSettingAction, { color: palette.accent }]}>{languageSettings.language === "ur" ? "English" : "اردو"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAppearanceOpen(true)}
                style={[styles.profileSetting, { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <Text style={[styles.profileSettingTitle, { color: palette.text }]}>Appearance</Text>
                <Text style={[styles.profileSettingAction, { color: palette.accent }]}>Change theme and accent colour</Text>
              </Pressable>
              <RiderProfile
                session={session}
                onUpdateUser={onUpdateUser}
                security={security}
                onPasswordChanged={async () => {
                  await gps.stop(false);
                  await onPasswordChanged();
                }}
              />
            </>
          )}
        </>
      )}
      {cashOpen && (
        <CodHandoverModal
          session={session}
          onClose={() => {
            setCashOpen(false);
            setCashRevision((v) => v + 1);
          }}
          onChanged={() => setCashRevision((v) => v + 1)}
        />
      )}
      {warehouseDelivery && (
        <WarehouseReturnModal
          session={session}
          delivery={warehouseDelivery}
          onClose={() => {
            setWarehouseDelivery(null);
            setReload((value) => value + 1);
          }}
          onUpdated={() => {
            if (gps.orderId === warehouseDelivery.id) gps.stop();
            setWarehouseDelivery(null);
            setNotice(
              "Parcel return reported. Waiting for administrator receipt confirmation.",
            );
            setCashRevision((v) => v + 1);
            setReload((value) => value + 1);
          }}
        />
      )}
      {failureDelivery && (
        <DeliveryFailureModal
          session={session}
          delivery={failureDelivery}
          onClose={() => {
            setFailureDelivery(null);
            setReload((value) => value + 1);
          }}
          onRecorded={() => {
            setFailureDelivery(null);
            setNotice(
              "Delivery failure recorded. The administrator has been notified.",
            );
            setCashRevision((v) => v + 1);
            setReload((value) => value + 1);
          }}
        />
      )}
      {notificationsOpen && (
        <NotificationsModal
          session={session}
          onClose={() => setNotificationsOpen(false)}
        />
      )}
      <AppearanceModal
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f6fb" },
  grow: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#6254a0",
  },
  title: {
    fontSize: 25,
    fontWeight: "900",
    color: "#182235",
    marginTop: 3,
  },
  iconButton: {
    minWidth: 50,
    minHeight: 50,
    backgroundColor: "#ece8fa",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  welcome: {
    marginHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "#e9e5fb",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileSetting: {
    minHeight: 58,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  profileSettingTitle: { flex: 1, fontSize: 14, fontWeight: "800" },
  profileSettingAction: { fontSize: 13, fontWeight: "800" },
  welcomeName: { fontSize: 23, fontWeight: "900", color: "#2c2450" },
  welcomeText: { color: "#50476c", lineHeight: 21, fontSize: 14, marginTop: 5 },
  truck: {
    width: 58,
    height: 58,
    backgroundColor: "#d8cff5",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  viewTabs: {
    flexDirection: "row",
    backgroundColor: "#e9eaf1",
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  viewTab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  viewTabActive: { backgroundColor: "#553bb5" },
  viewTabText: { color: "#434b5d", fontWeight: "800", fontSize: 13 },
  activeTabText: { color: "#fff" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 13,
    gap: 10,
  },
  sectionTitle: { fontSize: 22, fontWeight: "900", color: "#182235" },
  muted: { color: "#4f5b6f", fontSize: 13, lineHeight: 20, marginTop: 4 },
  refreshButton: {
    minHeight: 50,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: "#553bb5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  refreshText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    minHeight: 50,
    backgroundColor: "#e7e9f0",
    paddingHorizontal: 3,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: { backgroundColor: "#553bb5" },
  tabText: { color: "#30394c", fontSize: 13, fontWeight: "800" },
  locationBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 13,
    backgroundColor: "#e7f4ec",
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  locationTitle: { color: "#204b38", fontSize: 14, fontWeight: "900" },
  locationCopy: { color: "#315c48", fontSize: 12, lineHeight: 18, marginTop: 3 },
  stopLocation: {
    minHeight: 42,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 11,
  },
  stopLocationText: { color: "#245b43", fontSize: 13, fontWeight: "900" },
  deliveryList: { flex: 1 },
  deliveryListContent: { paddingBottom: 28 },
  card: {
    padding: 17,
    marginHorizontal: 16,
    marginTop: 5,
    marginBottom: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4ed",
    borderRadius: 20,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardEyebrow: { color: "#5b6474", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  orderNumber: { color: "#333d50", fontSize: 13, fontWeight: "800", marginTop: 3 },
  status: {
    maxWidth: "52%",
    color: "#3c3470",
    backgroundColor: "#ece9fb",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  delivered: { backgroundColor: "#e1f4e8", color: "#145a34" },
  returned: { backgroundColor: "#fff0d1", color: "#8a4b08" },
  customer: { fontSize: 21, fontWeight: "900", color: "#182235", marginTop: 17 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 },
  address: { flex: 1, fontSize: 15, color: "#344156", lineHeight: 22 },
  amountPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 7,
    padding: 14,
    borderRadius: 15,
    backgroundColor: "#f0edfb",
  },
  amountLabel: { color: "#40365f", fontSize: 13, fontWeight: "900" },
  payment: { color: "#3f4b5d", fontSize: 12, lineHeight: 18, marginTop: 5 },
  amount: { maxWidth: "48%", fontSize: 22, fontWeight: "900", color: "#5036ae", textAlign: "right" },
  stepLabel: { color: "#465166", fontSize: 11, fontWeight: "900", letterSpacing: 0.5, marginTop: 13, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 9 },
  secondary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: "#efedfa",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  link: { color: "#3f2e91", fontSize: 14, fontWeight: "900" },
  primary: {
    minHeight: 56,
    justifyContent: "center",
    backgroundColor: "#4c32a5",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  white: { color: "#fff", fontSize: 16, textAlign: "center", fontWeight: "900" },
  whatsappButton: { backgroundColor: "#e5f4e9" },
  whatsappText: { color: "#145b38", fontSize: 14, fontWeight: "900" },
  gpsButton: {
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e7f4ec",
    padding: 12,
    borderRadius: 12,
  },
  failureButton: {
    minHeight: 48,
    justifyContent: "center",
    backgroundColor: "#fff0e8",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 9,
  },
  failureText: { color: "#84350d", fontSize: 14, fontWeight: "900", textAlign: "center" },
  waitingNote: { color: "#354256", backgroundColor: "#f1f3f7", padding: 13, borderRadius: 12, fontSize: 13, lineHeight: 20, marginTop: 12 },
  warehouseButton: { minHeight: 48, justifyContent: "center", backgroundColor: "#fff4dd", padding: 12, borderRadius: 12, marginTop: 10 },
  warehouseText: { color: "#684b13", fontSize: 13, fontWeight: "900", textAlign: "center" },
  dim: { opacity: 0.5 },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginHorizontal: 16, marginTop: 3 },
  pageButton: { minWidth: 92, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#553bb5" },
  disabledButton: { opacity: 0.42 },
  pageButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  pageCount: { flex: 1, color: "#334155", fontSize: 13, fontWeight: "800", textAlign: "center" },
  listEndSpace: { height: 24 },
  loader: { marginVertical: 32 },
  notice: { marginHorizontal: 16, marginBottom: 10, padding: 13, borderRadius: 12, backgroundColor: "#e5f4e9", color: "#145b38", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  error: { marginHorizontal: 16, marginBottom: 12, padding: 13, borderRadius: 12, backgroundColor: "#fde9e9", color: "#8a2020", fontSize: 14, lineHeight: 21, fontWeight: "700" },
  empty: { margin: 16, padding: 24, alignItems: "center", backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#dfe4ed" },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#ece9fb", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#182235", fontSize: 20, fontWeight: "900", marginTop: 14 },
  emptyCopy: { color: "#3d485a", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 7 },
});
const styleColors = {
  screen: c => ({ backgroundColor: c.background }), header: c => ({ backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }),
  eyebrow: c => ({ color: c.accent }), title: c => ({ color: c.text }), iconButton: c => ({ backgroundColor: c.soft }),
  welcome: c => ({ backgroundColor: c.accentSoft }), welcomeName: c => ({ color: c.text }), welcomeText: c => ({ color: c.muted }), truck: c => ({ backgroundColor: c.soft }),
  viewTabs: c => ({ backgroundColor: c.soft }), viewTabActive: c => ({ backgroundColor: c.accent }), viewTabText: c => ({ color: c.text }),
  sectionTitle: c => ({ color: c.text }), muted: c => ({ color: c.muted }), refreshButton: c => ({ backgroundColor: c.accent }),
  tab: c => ({ backgroundColor: c.soft }), activeTab: c => ({ backgroundColor: c.accent }), tabText: c => ({ color: c.text }),
  locationBanner: c => ({ backgroundColor: c.successSoft }), locationTitle: c => ({ color: c.success }), locationCopy: c => ({ color: c.text }),
  stopLocation: c => ({ backgroundColor: c.surface }), stopLocationText: c => ({ color: c.success }), deliveryList: c => ({ backgroundColor: c.background }),
  card: c => ({ backgroundColor: c.surface, borderColor: c.border }), cardEyebrow: c => ({ color: c.muted }), orderNumber: c => ({ color: c.text }),
  status: c => ({ color: c.accent, backgroundColor: c.accentSoft }), delivered: c => ({ backgroundColor: c.successSoft, color: c.success }),
  customer: c => ({ color: c.text }), address: c => ({ color: c.text }), amountPanel: c => ({ backgroundColor: c.accentSoft }),
  amountLabel: c => ({ color: c.text }), payment: c => ({ color: c.muted }), amount: c => ({ color: c.accent }), stepLabel: c => ({ color: c.muted }),
  secondary: c => ({ backgroundColor: c.soft }), link: c => ({ color: c.accent }), primary: c => ({ backgroundColor: c.accent }),
  whatsappButton: c => ({ backgroundColor: c.successSoft }), whatsappText: c => ({ color: c.success }), gpsButton: c => ({ backgroundColor: c.successSoft }),
  failureButton: c => ({ backgroundColor: c.dangerSoft }), failureText: c => ({ color: c.danger }), waitingNote: c => ({ color: c.text, backgroundColor: c.soft }),
  warehouseButton: c => ({ backgroundColor: c.warning === "#fbbf24" ? "#3b3020" : "#fff4dd" }), warehouseText: c => ({ color: c.warning }),
  pageButton: c => ({ backgroundColor: c.accent }), pageCount: c => ({ color: c.text }),
  notice: c => ({ color: c.success, backgroundColor: c.successSoft }), error: c => ({ color: c.danger, backgroundColor: c.dangerSoft }),
  empty: c => ({ backgroundColor: c.surface, borderColor: c.border }), emptyIcon: c => ({ backgroundColor: c.accentSoft }),
  emptyTitle: c => ({ color: c.text }), emptyCopy: c => ({ color: c.muted }),
};
const styles = new Proxy(baseStyles, { get(target, key) {
  if (typeof key !== "string") return target[key];
  const override = styleColors[key]?.(riderPalette);
  return override ? [target[key], override] : target[key];
}});
