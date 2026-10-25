import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import RiderDashboard from "./RiderDashboard";
import CodHandoverModal from "./CodHandoverModal";
import WarehouseReturnModal from "./WarehouseReturnModal";
import { useRiderLocation } from "./useRiderLocation";
import DeliveryFailureModal from "./DeliveryFailureModal";
import NotificationsModal from "../notifications/NotificationsModal";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
const readable = (value = "") => value.replace(/_/g, " ").toLowerCase();
const paths = {
  chat: "M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5Z",
  truck: "M2 5h12v12H2V5Zm12 4h4l4 5v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  refresh: "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
  phone: "M7 3H3v4c0 8 6 14 14 14h4v-4l-5-2-2 2a12 12 0 0 1-7-7l2-2-2-5Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
};
function Icon({ name, color = "#7c3aed", size = 21 }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d={paths[name]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

async function request(token, path = "", method = "GET", signal) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");
  const response = await fetch(`${baseUrl}/api/mobile/rider/deliveries${path}`, {
    method, credentials: "omit", headers: { Authorization: `Bearer ${token}` }, signal,
  });
  if (!response.ok) {
    const messages = {
      401: "Your session expired. Sign out and sign in again.",
      403: "Rider access is required.",
      404: "This delivery was not found or is no longer assigned to you.",
      409: "This action is unavailable at the current delivery stage. Refresh the list.",
    };
    throw new Error(messages[response.status] || "Could not confirm the request. Refresh before trying again.");
  }
  return response.status === 204 ? null : response.json();
}

export default function RiderScreen({ session, onSignOut, signingOut, sessionError }) {
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
  const [failureDelivery, setFailureDelivery] = useState(null);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request(token, `?page=${page}&size=10&section=${section}`, "GET", controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(0, data.totalPages - 1);
        if (page > lastPage) { setPage(lastPage); return; }
        const sharing = data.items.find((item) => item.id === gps.orderId);
        if (sharing?.warehouseReturnPending) gps.stop();
        if (!controller.signal.aborted) setResult({ token, section, page, reload, data, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setResult({ token, section, page, reload, data: null, error: failure.message });
      });
    return () => controller.abort();
  }, [token, section, page, reload]);

  const current = result?.token === token && result?.section === section && result?.page === page && result?.reload === reload;
  const data = current ? result.data : null;

  async function openLink(url) {
    setError("");
    try { await Linking.openURL(url); }
    catch { setError("Could not open the phone or WhatsApp app."); }
  }

  function openWhatsApp(item) {
    let number = String(item.phone || "").replace(/\D/g, "");
    if (number.startsWith("00")) number = number.slice(2);
    if (/^03[0-9]{9}$/.test(number)) number = "92" + number.slice(1);
    if (!/^923[0-9]{9}$/.test(number)) {
      setError("The customer's phone number must be a valid Pakistani mobile number for WhatsApp.");
      return;
    }
    const text = `Assalam o Alaikum, I am your ShopMart rider for order ${item.orderNumber}. Please share your current location on WhatsApp so I can find your delivery address.`;
    openLink(`https://wa.me/${number}?text=${encodeURIComponent(text)}`);
  }

  async function complete(item) {
    if (item.warehouseReturnPending) {
      setError("This parcel is in the warehouse return process. Wait for the administrator to arrange a retry.");
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setBusyId(item.id);
    setError(""); setNotice("");
    try {
      if (gps.orderId === item.id) await gps.stop();
      await request(token, `/${encodeURIComponent(item.id)}/complete`, "PATCH");
      setNotice(`${item.orderNumber} marked as delivered.`);
      setCashRevision(v => v + 1);
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
    const amount = new Intl.NumberFormat("en-PK", { style: "currency", currency: item.currency || "PKR" }).format(Number(item.total));
    Alert.alert("Confirm successful delivery", item.paymentMethod === "COD"
      ? `Only confirm after handing over the parcel and collecting ${amount} in cash. This also marks the COD payment as paid.`
      : "Only confirm after handing over the parcel. This does not collect real cash for a demo payment.", [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm delivered", onPress: () => complete(item) },
      ]);
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", "You will need to sign in again to access deliveries.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", onPress: async () => { await gps.stop(false); onSignOut(); } },
    ]);
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar style="dark" />
    <View style={styles.header}>
      <View style={styles.grow}>
        <Text style={styles.eyebrow}>SHOPMART RIDER</Text>
        <Text style={styles.title}>{view === "dashboard" ? "Rider dashboard" : "Your deliveries"}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => setNotificationsOpen(true)} style={styles.iconButton}><Icon name="bell" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={Boolean(busyId) || signingOut} onPress={confirmSignOut} style={styles.iconButton}>
        {signingOut ? <ActivityIndicator color="#7c3aed" /> : <Icon name="logout" color="#9a839e" />}
      </Pressable>
    </View>
    <View style={styles.welcome}>
      <View style={styles.grow}>
        <Text style={styles.welcomeName}>Hi, {session.user.name?.split(" ")[0] || "Rider"}</Text>
        <Text style={styles.welcomeText}>Your assigned deliveries, all in one place.</Text>
      </View>
      <View style={styles.truck}><Icon name="truck" size={35} /></View>
    </View>
    <View style={styles.viewTabs}>
      {[["dashboard", "Dashboard"], ["deliveries", "Deliveries"]].map(([value, title]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: view === value }} disabled={Boolean(busyId)} onPress={() => setView(value)} style={[styles.viewTab, view === value && styles.viewTabActive]}><Text style={[styles.viewTabText, view === value && styles.activeTabText]}>{title}</Text></Pressable>)}
    </View>
    {view === "dashboard" && sessionError ? <Text accessibilityRole="alert" style={styles.error}>{sessionError}</Text> : null}
    {view === "dashboard" && gps.orderId && <View style={styles.gpsInfo}><Text style={styles.gpsText}>Rider GPS sharing is active for one delivery.</Text><Pressable accessibilityRole="button" onPress={() => gps.stop()} style={styles.gpsStop}><Text style={styles.link}>Stop sharing</Text></Pressable></View>}
    {view === "dashboard" ? <RiderDashboard session={session} revision={cashRevision} onOpenCash={() => setCashOpen(true)} onOpenDeliveries={() => setView("deliveries")} /> : <>
    <View style={styles.section}>
      <View style={styles.grow}>
        <Text style={styles.sectionTitle}>{section === "ASSIGNED" ? "Assigned to you" : section === "DELIVERED" ? "Delivered orders" : "Cancelled orders"}</Text>
        <Text style={styles.muted}>{data ? `${data.totalItems} order(s) in this section` : "Checking your deliveries..."}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh deliveries" disabled={!current || Boolean(busyId)} onPress={() => setReload((value) => value + 1)} style={styles.iconButton}>
        {!current ? <ActivityIndicator color="#7c3aed" /> : <Icon name="refresh" />}
      </Pressable>
    </View>
    <View style={styles.tabs}>
      {[["ASSIGNED", "Assigned"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"]].map(([value, title]) =>
        <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: section === value }} disabled={Boolean(busyId)}
          onPress={() => { setSection(value); setPage(0); setError(""); setNotice(""); }} style={[styles.tab, section === value && styles.activeTab]}>
          <Text style={[styles.tabText, section === value && styles.activeTabText]}>{title}</Text>
        </Pressable>)}
    </View>
    <View style={styles.gpsInfo}>
      <Text style={styles.gpsText}>{gps.orderId ? "GPS sharing is on for one delivery. " : "GPS sharing is off. "}Sharing runs only while ShopMart is active.</Text>
      {gps.message ? <Text style={styles.gpsText}>{gps.message}</Text> : null}
      {gps.orderId && <Pressable accessibilityRole="button" onPress={() => gps.stop()} style={styles.gpsStop}><Text style={styles.link}>Stop sharing</Text></Pressable>}
    </View>
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    {error || sessionError ? <Text accessibilityRole="alert" style={styles.error}>{error || sessionError}</Text> : null}
    {!current ? <ActivityIndicator size="large" color="#7c3aed" style={styles.loader} />
      : result.error ? <Text accessibilityRole="alert" style={styles.error}>{result.error}</Text>
      : <>
        <FlatList data={data.items} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Icon name="truck" size={45} /><Text style={styles.emptyTitle}>No deliveries on this page</Text><Text style={styles.muted}>New assignments appear here after the admin assigns them.</Text></View>}
          renderItem={({ item }) => {
            const delivered = item.status === "DELIVERED";
            const dispatched = item.status === "DISPATCHED";
            return <View style={styles.card}>
              <View style={styles.cardHeader}><Text style={styles.orderNumber}>{item.orderNumber}</Text><Text style={[styles.status, delivered && styles.delivered]}>{readable(item.status)}</Text></View>
              <Text style={styles.customer}>{item.customerName}</Text>
              <View style={styles.addressRow}><Icon name="pin" size={17} color="#9c90b0" /><Text style={styles.address}>{item.address}</Text></View>
              <View style={styles.amountRow}><View style={styles.grow}><Text style={styles.muted}>{item.paymentMethod === "COD" ? "Cash on delivery" : readable(item.paymentMethod)}</Text><Text style={styles.payment}>{readable(item.paymentStatus)}</Text></View><Text style={styles.amount}>{new Intl.NumberFormat("en-PK", { style: "currency", currency: item.currency || "PKR" }).format(Number(item.total))}</Text></View>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Call ${item.customerName}`} onPress={() => openLink(`tel:${item.phone.replace(/[^0-9+]/g, "")}`)} style={styles.secondary}><Icon name="phone" size={17} /><Text style={styles.link}>Call customer</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Ask ${item.customerName} for their location on WhatsApp`} onPress={() => openWhatsApp(item)} style={[styles.secondary, styles.whatsappButton]}><Icon name="chat" size={17} color="#16804d" /><Text style={styles.whatsappText}>WhatsApp</Text></Pressable>
              </View>
              {dispatched && !item.warehouseReturnPending && <Pressable accessibilityRole="button" disabled={Boolean(busyId) || gps.busy} onPress={async () => { if (gps.orderId === item.id) await gps.stop(); setFailureDelivery(item); }} style={[styles.failureButton, Boolean(busyId) && styles.dim]}><Text style={styles.failureText}>Report delivery failure</Text></Pressable>}
              {dispatched && !item.warehouseReturnPending && <Pressable accessibilityRole="button" disabled={gps.busy || Boolean(busyId)} onPress={() => gps.orderId === item.id ? gps.stop() : gps.start(item)} style={styles.gpsButton}>
                <Text style={styles.link}>{gps.busy ? "Preparing GPS..." : gps.orderId === item.id ? "Stop sharing this delivery" : gps.orderId ? "Switch GPS sharing to this delivery" : "Start sharing rider location"}</Text>
              </Pressable>}
              {item.lastAttempt && <Pressable accessibilityRole="button" disabled={Boolean(busyId)} onPress={() => setWarehouseDelivery(item)} style={styles.warehouseButton}><Text style={styles.warehouseText}>Return to warehouse / view status</Text></Pressable>}
              {item.lastAttempt && <View style={styles.attempt}><Text style={styles.attemptTitle}>Last attempt: {readable(item.lastAttempt.reason)}</Text>{item.lastAttempt.note ? <Text style={styles.muted}>{item.lastAttempt.note}</Text> : null}</View>}
              {dispatched ? <>
                <Pressable accessibilityRole="button" disabled={Boolean(busyId) || item.warehouseReturnPending} onPress={() => confirmDelivery(item)} style={[styles.primary, (Boolean(busyId) || item.warehouseReturnPending) && styles.dim]}><Text style={styles.white}>{item.warehouseReturnPending ? "Awaiting warehouse resolution" : busyId === item.id ? "Updating..." : "Mark as delivered"}</Text></Pressable>
                {item.warehouseReturnPending && <Text style={styles.stageNote}>Parcel returned to warehouse. Delivery completion is disabled until the administrator arranges another attempt.</Text>}
              </>
                : <Text style={styles.stageNote}>{delivered ? "Delivery completed." : "Delivery completion becomes available after dispatch."}</Text>}
            </View>;
          }} />
        {data.totalPages > 1 && <View style={styles.pagination}>
          <Pressable accessibilityRole="button" disabled={page === 0 || Boolean(busyId)} onPress={() => setPage((value) => value - 1)} style={styles.pageButton}><Text style={styles.link}>Previous</Text></Pressable>
          <Text style={styles.muted}>{page + 1} / {data.totalPages}</Text>
          <Pressable accessibilityRole="button" disabled={page + 1 >= data.totalPages || Boolean(busyId)} onPress={() => setPage((value) => value + 1)} style={styles.pageButton}><Text style={styles.link}>Next</Text></Pressable>
        </View>}
      </>}
    </>}
    {cashOpen && <CodHandoverModal session={session} onClose={() => { setCashOpen(false); setCashRevision(v => v + 1); }} onChanged={() => setCashRevision(v => v + 1)} />}
    {warehouseDelivery && <WarehouseReturnModal session={session} delivery={warehouseDelivery}
      onClose={() => { setWarehouseDelivery(null); setReload((value) => value + 1); }}
      onUpdated={() => { if (gps.orderId === warehouseDelivery.id) gps.stop(); setWarehouseDelivery(null); setNotice("Parcel return reported. Waiting for administrator receipt confirmation."); setCashRevision(v => v + 1); setReload((value) => value + 1); }} />}
    {failureDelivery && <DeliveryFailureModal session={session} delivery={failureDelivery}
      onClose={() => { setFailureDelivery(null); setReload((value) => value + 1); }}
      onRecorded={() => { setFailureDelivery(null); setNotice("Delivery failure recorded. The administrator has been notified."); setCashRevision(v => v + 1); setReload((value) => value + 1); }} />}
    {notificationsOpen && <NotificationsModal session={session} onClose={() => setNotificationsOpen(false)} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  viewTabs: { flexDirection: "row", backgroundColor: "#f0eafa", borderRadius: 15, padding: 5, marginHorizontal: 20, marginTop: 16, marginBottom: 3 },
  viewTab: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 11 },
  viewTabActive: { backgroundColor: "#7c3aed" },
  viewTabText: { color: "#a28bb6", fontWeight: "700", fontSize: 12 },
  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  tab: { flex: 1, backgroundColor: "#f0eafa", paddingVertical: 13, borderRadius: 13, alignItems: "center" },
  activeTab: { backgroundColor: "#7c3aed" },
  tabText: { color: "#9c83b6", fontSize: 12, fontWeight: "700" },
  activeTabText: { color: "#fff" },
  gpsInfo: { marginHorizontal: 20, padding: 12, backgroundColor: "#f1f8f3", borderRadius: 13, marginBottom: 14 },
  gpsText: { color: "#789480", fontSize: 10, lineHeight: 17 },
  gpsStop: { paddingVertical: 10, alignSelf: "flex-start" },
  gpsButton: { backgroundColor: "#edf8f0", padding: 14, borderRadius: 12, marginTop: 12, alignItems: "center" },
  warehouseButton: { backgroundColor: "#fff7e9", padding: 14, borderRadius: 12, marginTop: 12 },
  warehouseText: { color: "#b18a46", fontSize: 11, fontWeight: "700", textAlign: "center" },
  screen: { flex: 1, backgroundColor: "#faf9fd" },
  grow: { flex: 1, minWidth: 0 },
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 9 },
  eyebrow: { fontSize: 8, fontWeight: "800", letterSpacing: 1.7, color: "#a28cb8" },
  title: { fontSize: 25, fontWeight: "800", color: "#28213b", marginTop: 5, letterSpacing: -0.7 },
  iconButton: { width: 44, height: 44, backgroundColor: "#f0eafa", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  welcome: { marginHorizontal: 20, borderRadius: 23, backgroundColor: "#eee7fb", padding: 20, flexDirection: "row", alignItems: "center", gap: 13 },
  welcomeName: { fontSize: 22, fontWeight: "800", color: "#3b2c52" },
  welcomeText: { color: "#9583ad", lineHeight: 21, fontSize: 12, marginTop: 7 },
  truck: { width: 65, height: 65, backgroundColor: "#e4d8f9", borderRadius: 20, alignItems: "center", justifyContent: "center" },
  section: { flexDirection: "row", alignItems: "center", padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#383047" },
  muted: { color: "#9b90a6", fontSize: 11, lineHeight: 19, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 25 },
  card: { padding: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eae4f2", borderRadius: 21, marginBottom: 16 },
  cardHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 9 },
  orderNumber: { color: "#8a7b9d", fontSize: 11, fontWeight: "700" },
  status: { color: "#7c3aed", backgroundColor: "#f2ebfc", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  delivered: { backgroundColor: "#ecfdf5", color: "#15803d" },
  customer: { fontSize: 18, fontWeight: "800", color: "#3c314c", marginTop: 18 },
  addressRow: { flexDirection: "row", gap: 7, marginTop: 10 },
  address: { flex: 1, fontSize: 12, color: "#9b90a6", lineHeight: 20 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 17, paddingTop: 13, borderTopWidth: 1, borderTopColor: "#f3eef7" },
  payment: { color: "#a496b3", fontSize: 10, marginTop: 4, textTransform: "capitalize" },
  amount: { maxWidth: "55%", fontSize: 20, fontWeight: "800", color: "#7c3aed", letterSpacing: -0.6 },
  actions: { flexDirection: "row", gap: 8 },
  secondary: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#f6f2fc", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  link: { color: "#7c3aed", fontSize: 11, fontWeight: "700" },
  primary: { backgroundColor: "#7c3aed", borderRadius: 13, padding: 15, marginTop: 12 },
  white: { color: "#fff", fontSize: 12, textAlign: "center", fontWeight: "700" },
  whatsappButton: { backgroundColor: "#edf9f1" },
  whatsappText: { color: "#16804d", fontSize: 11, fontWeight: "700" },
  failureButton: { backgroundColor: "#fff3f5", padding: 14, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: "#f8dfe6" },
  failureText: { color: "#c45b78", fontSize: 12, fontWeight: "700", textAlign: "center" },
  dim: { opacity: 0.5 },
  stageNote: { color: "#a59aaf", fontSize: 11, lineHeight: 19, marginTop: 14 },
  attempt: { backgroundColor: "#fff8ed", padding: 12, borderRadius: 12, marginTop: 12 },
  attemptTitle: { color: "#ab7b36", fontWeight: "600", fontSize: 11, textTransform: "capitalize" },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff" },
  pageButton: { padding: 13, backgroundColor: "#f0eafa", borderRadius: 12 },
  loader: { marginTop: 35 },
  notice: { marginHorizontal: 20, marginBottom: 13, color: "#15803d", lineHeight: 21, fontSize: 12 },
  error: { marginHorizontal: 20, marginBottom: 15, color: "#be123c", lineHeight: 21, fontSize: 12 },
  empty: { paddingVertical: 45, alignItems: "center" },
  emptyTitle: { color: "#70617e", fontSize: 17, fontWeight: "700", marginTop: 18 },
});
