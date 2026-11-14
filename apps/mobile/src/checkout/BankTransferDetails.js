import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMobileAppearance } from "../appearance/MobileAppearance";

const DEMO_ACCOUNT = {
  bank: "ShopMart Demo Bank (fictional)",
  title: "ShopMart Test Store",
  account: "0000 0000 0000",
  iban: "PK00-DEMO-0000-0000-0000",
  whatsapp: "923263101049",
};

export default function BankTransferDetails({ total, name, phone, onBack, onClose, onPlaceOrder, busy = false, error = "" }) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const [receiptOpened, setReceiptOpened] = useState(false);
  const message = `Hello ShopMart, I have made a demo bank transfer. Name: ${name || ""}. Phone: ${phone || ""}. Cart total: PKR ${Number(total || 0).toLocaleString("en-PK")}. I will attach the transfer receipt here.`;
  async function sendReceipt() {
    try {
      await Linking.openURL(`https://wa.me/${DEMO_ACCOUNT.whatsapp}?text=${encodeURIComponent(message)}`);
      setReceiptOpened(true);
    } catch {
      Alert.alert("WhatsApp could not be opened", "Install WhatsApp or try again.");
    }
  }
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>DEMO PAYMENT DETAILS</Text>
          <Text style={[styles.title, { color: palette.text }]}>Bank transfer</Text>
          <Text style={[styles.body, { color: palette.muted }]}>For this demo, send the receipt message to ShopMart on WhatsApp. Include your name and phone number so the pending order can be matched.</Text>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Detail palette={palette} label="Bank" value={DEMO_ACCOUNT.bank} />
            <Detail palette={palette} label="Account title" value={DEMO_ACCOUNT.title} />
            <Detail palette={palette} label="Account number" value={DEMO_ACCOUNT.account} />
            <Detail palette={palette} label="IBAN (demo)" value={DEMO_ACCOUNT.iban} />
            <Detail palette={palette} label="Amount to transfer" value={`PKR ${Number(total || 0).toLocaleString("en-PK")}`} strong />
          </View>
          <Text style={[styles.warning, { color: theme.isDark ? "#fbbf24" : "#854d0e", backgroundColor: theme.isDark ? "#392d18" : "#fff7e6" }]}><Text style={styles.bold}>Demo only:</Text> these fictional details cannot receive money. The order created here is marked Bank transfer / Pending and must not be treated as paid.</Text>
          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={sendReceipt} style={styles.whatsapp}><Text style={styles.buttonText}>Send receipt on WhatsApp · 0326 3101049</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!receiptOpened || busy} onPress={onPlaceOrder} style={[styles.place, { backgroundColor: palette.accent }, (!receiptOpened || busy) && styles.disabled]}><Text style={styles.buttonText}>{busy ? "Placing order…" : "I sent it — place demo order"}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onBack} style={[styles.back, { backgroundColor: palette.soft }]}><Text style={[styles.backText, { color: palette.text }]}>Back to checkout</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Detail({ label, value, strong = false, palette }) {
  return <View style={styles.detail}><Text style={[styles.label, { color: palette.muted }]}>{label}</Text><Text selectable style={[styles.value, { color: palette.text }, strong && { color: palette.accent }, strong && styles.strong]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 22, paddingBottom: 40 },
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#17203c", fontSize: 28, fontWeight: "900", marginTop: 7 },
  body: { color: "#64748b", fontSize: 14, lineHeight: 22, marginTop: 8 },
  card: { backgroundColor: "#f5f1ff", borderWidth: 1, borderColor: "transparent", borderRadius: 18, padding: 16, marginTop: 22, gap: 15 },
  detail: { gap: 3 }, label: { color: "#7c859b", fontSize: 11 },
  value: { color: "#25304a", fontSize: 15, fontWeight: "700" },
  strong: { color: "#6d28d9", fontSize: 20, fontWeight: "900" },
  warning: { color: "#854d0e", backgroundColor: "#fff7e6", borderRadius: 12, padding: 13, fontSize: 12, lineHeight: 19, marginTop: 16 },
  bold: { fontWeight: "900" },
  whatsapp: { backgroundColor: "#16804d", padding: 15, borderRadius: 13, alignItems: "center", marginTop: 18 },
  place: { backgroundColor: "#7c3aed", padding: 15, borderRadius: 13, alignItems: "center", marginTop: 10 },
  disabled: { opacity: 0.45 },
  error: { color: "#be123c", fontSize: 13, marginTop: 12 },
  buttonText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  back: { backgroundColor: "#f1f5f9", padding: 14, borderRadius: 13, alignItems: "center", marginTop: 10 },
  backText: { color: "#475569", fontWeight: "800" },
});
