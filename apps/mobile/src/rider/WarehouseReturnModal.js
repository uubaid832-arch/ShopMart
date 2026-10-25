import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
const readable = (value = "") => value.replace(/_/g, " ").toLowerCase();

export default function WarehouseReturnModal({ session, delivery, onClose, onUpdated }) {
  const token = session.accessToken;
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${baseUrl}/api/mobile/rider/deliveries/${delivery.id}/warehouse`, {
      credentials: "omit", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load warehouse status. Refresh or sign in again.");
      return response.json();
    }).then((data) => { if (!controller.signal.aborted) setResult({ token, reload, data, error: "" }); })
      .catch((failure) => { if (!controller.signal.aborted) setResult({ token, reload, error: failure.message }); });
    return () => controller.abort();
  }, [token, reload, delivery.id]);
  const current = result?.token === token && result?.reload === reload;
  const state = current ? result.data : null;
  function close() { if (!pending.current) onClose(); }
  async function report() {
    if (pending.current || !state?.attemptId) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`${baseUrl}/api/mobile/rider/deliveries/${delivery.id}/warehouse-return`, {
        method: "PATCH", credentials: "omit",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: state.attemptId }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "This attempt changed or is already resolved. Refresh the status." : "Could not confirm the warehouse report. Refresh before retrying.");
      onUpdated();
    } catch (failure) { setError(failure.message); }
    finally { pending.current = false; setBusy(false); setReload((value) => value + 1); }
  }
  return <Modal visible animationType="slide" onRequestClose={close}><SafeAreaView style={styles.screen}>
    <View style={styles.header}><Text style={styles.title}>Return to warehouse</Text><Pressable accessibilityRole="button" disabled={busy} onPress={close} style={styles.button}><Text style={styles.link}>Close</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.order}>{delivery.orderNumber}</Text><Text style={styles.name}>{delivery.customerName}</Text>
      <Pressable accessibilityRole="button" disabled={busy || !current} onPress={() => setReload((value) => value + 1)} style={styles.button}><Text style={styles.link}>Check latest status</Text></Pressable>
      {!current ? <ActivityIndicator color="#7c3aed" /> : result.error ? <Text style={styles.error}>{result.error}</Text> : !state.attemptId ? <Text style={styles.description}>Report an unsuccessful delivery attempt first.</Text> : <View style={styles.card}>
        <Text style={styles.label}>Last delivery attempt</Text><Text style={styles.name}>{readable(state.reason)}</Text>{state.note ? <Text style={styles.description}>{state.note}</Text> : null}
        <Text style={styles.label}>Warehouse progress</Text>
        <Text style={styles.description}>{state.resolvedAt ? `Resolved: ${readable(state.resolution)}` : state.receivedAt ? "Administrator confirmed receipt. Waiting for retry or cancellation decision." : state.reportedAt ? "Return reported. Waiting for the administrator to confirm receipt." : "Not yet reported as returned to the warehouse."}</Text>
        {!state.reportedAt && !state.resolvedAt && delivery.status === "DISPATCHED" && <Pressable accessibilityRole="button" disabled={busy} onPress={() => Alert.alert("Parcel physically returned?", "Only confirm after handing the parcel back to the warehouse. The administrator will confirm receipt separately.", [{ text: "Cancel", style: "cancel" }, { text: "Confirm returned", onPress: report }])} style={styles.primary}><Text style={styles.white}>{busy ? "Reporting..." : "Confirm parcel returned"}</Text></Pressable>}
      </View>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.description}>The rider reports the physical return. Only the administrator can confirm warehouse receipt and schedule another attempt or cancellation.</Text>
    </ScrollView>
  </SafeAreaView></Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" }, header: { padding: 20, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: "#3b2c50" }, content: { padding: 20 },
  button: { padding: 13, borderRadius: 12, backgroundColor: "#f2ecfc", alignSelf: "flex-start", marginVertical: 12 }, link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  order: { color: "#a292b1", fontSize: 12 }, name: { color: "#665176", fontSize: 16, fontWeight: "700", marginTop: 10, textTransform: "capitalize" },
  card: { backgroundColor: "#faf7ff", padding: 18, borderRadius: 18, marginTop: 12 }, label: { color: "#a08ab3", fontSize: 11, fontWeight: "700", marginTop: 16 },
  description: { color: "#9a89a8", fontSize: 12, lineHeight: 22, marginTop: 10 }, primary: { backgroundColor: "#7c3aed", padding: 16, borderRadius: 13, marginTop: 23 }, white: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
  error: { color: "#be123c", fontSize: 12, lineHeight: 21, marginVertical: 15 },
});
