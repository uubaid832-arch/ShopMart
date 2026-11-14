import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { codRequest, money } from "./codApi";
import { useMobileAppearance } from "../appearance/MobileAppearance";

let dashboardPalette = null;

export default function RiderDashboard({
  session,
  revision,
  onOpenCash,
  onOpenDeliveries,
}) {
  const { theme } = useMobileAppearance();
  dashboardPalette = theme.colors;
  const token = session.accessToken;
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    codRequest(token, "/dashboard", undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ token, reload, revision, data, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ token, reload, revision, error: error.message });
        }
      });

    return () => controller.abort();
  }, [token, reload, revision]);

  const current =
    result?.token === token &&
    result?.reload === reload &&
    result?.revision === revision;
  const data = current ? result.data : null;
  const stats = data
    ? [
        ["Delivered", data.successfulDeliveries, theme.colors.successSoft, theme.colors.success],
        ["Not delivered", data.failedAttempts, theme.colors.dangerSoft, theme.colors.danger],
        ["Waiting for you", data.assignedDeliveries, theme.colors.accentSoft, theme.colors.accent],
        ["Cancelled", data.cancelledOrders, theme.colors.soft, theme.colors.muted],
      ]
    : [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <View style={styles.grow}>
          <Text style={styles.heading}>Your work</Text>
          <Text style={styles.caption}>A simple look at your orders and cash.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh rider activity"
          disabled={!current}
          onPress={() => setReload((value) => value + 1)}
          style={styles.refresh}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {!current ? (
        <ActivityIndicator color={theme.colors.accent} size="large" style={styles.loader} />
      ) : result.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {result.error}
        </Text>
      ) : (
        <>
          <View style={styles.stats}>
            {stats.map(([label, value, backgroundColor, color]) => (
              <View key={label} style={[styles.stat, { backgroundColor }]}>
                <Text style={[styles.value, { color }]}>{value}</Text>
                <Text style={[styles.statLabel, { color }]}>{label}</Text>
              </View>
            ))}
          </View>

          {data.warehousePending > 0 ? (
            <View style={styles.alert}>
              <Text style={styles.alertTitle}>Parcel returned to the shop</Text>
              <Text style={styles.alertCopy}>
                {data.warehousePending} order(s) are waiting for the shop to check them.
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onOpenDeliveries}
            style={styles.deliveriesButton}
          >
            <Text style={styles.deliveriesTitle}>See my deliveries</Text>
            <Text style={styles.deliveriesCopy}>
              Open your order list and delivery steps.
            </Text>
          </Pressable>

          <View style={styles.cashCard}>
            <Text style={styles.cashEyebrow}>CASH ON DELIVERY</Text>
            <Text style={styles.cashHeading}>Cash to give to the shop</Text>
            <Text style={styles.balance}>{money(data.outstandingBalance)}</Text>
            <Text style={styles.balanceLabel}>
              This is shop cash you collected. It is not your pay.
            </Text>
            <View style={styles.cashRows}>
              {[
                ["Cash collected", data.totalCollected],
                ["Given to the shop", data.confirmedHandovers],
                ["Waiting for shop check", data.pendingHandovers],
                ["Ready to report", data.unreportedBalance],
              ].map(([label, value]) => (
                <View key={label} style={styles.cashRow}>
                  <Text style={styles.cashLabel}>{label}</Text>
                  <Text style={styles.cashValue}>{money(value)}</Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenCash}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Report cash to the shop</Text>
            </Pressable>
            <Text style={styles.note}>
              The shop must check and confirm the cash after you hand it over.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const baseStyles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 30 },
  grow: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heading: { color: "#182235", fontSize: 22, fontWeight: "900" },
  caption: { color: "#3d485a", fontSize: 14, lineHeight: 21, marginTop: 5 },
  refresh: {
    minHeight: 48,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "#553bb5",
    borderRadius: 13,
  },
  refreshText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  loader: { marginTop: 36 },
  error: {
    color: "#8a2020",
    backgroundColor: "#fde9e9",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 18,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 18,
  },
  stat: { width: "48%", minHeight: 104, padding: 16, borderRadius: 17 },
  value: { fontSize: 32, fontWeight: "900" },
  statLabel: { fontSize: 14, fontWeight: "900", marginTop: 8 },
  alert: {
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#fff4dd",
    marginTop: 14,
  },
  alertTitle: { color: "#684b13", fontSize: 15, fontWeight: "900" },
  alertCopy: { color: "#684b13", fontSize: 13, lineHeight: 20, marginTop: 5 },
  deliveriesButton: {
    padding: 17,
    borderRadius: 16,
    backgroundColor: "#e9e5fb",
    marginTop: 14,
  },
  deliveriesTitle: { color: "#34266f", fontSize: 17, fontWeight: "900" },
  deliveriesCopy: { color: "#40365f", fontSize: 13, lineHeight: 20, marginTop: 4 },
  cashCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dfe4ed",
    marginTop: 15,
  },
  cashEyebrow: { color: "#514190", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  cashHeading: { color: "#182235", fontSize: 18, fontWeight: "900", marginTop: 8 },
  balance: { fontSize: 29, fontWeight: "900", color: "#5036ae", marginTop: 8 },
  balanceLabel: { color: "#3d485a", fontSize: 13, lineHeight: 20, marginTop: 4 },
  cashRows: { marginTop: 15 },
  cashRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  cashLabel: { flex: 1, color: "#334155", fontSize: 13, lineHeight: 19 },
  cashValue: { color: "#182235", fontSize: 14, fontWeight: "900", maxWidth: "48%", textAlign: "right" },
  primary: {
    minHeight: 54,
    padding: 15,
    backgroundColor: "#4c32a5",
    borderRadius: 14,
    marginTop: 16,
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 15, textAlign: "center" },
  note: { color: "#3d485a", fontSize: 13, lineHeight: 20, marginTop: 12 },
});
const styleColors = {
  content: c => ({ backgroundColor: c.background }), heading: c => ({ color: c.text }), caption: c => ({ color: c.muted }),
  refresh: c => ({ backgroundColor: c.accent }), error: c => ({ color: c.danger, backgroundColor: c.dangerSoft }),
  alert: c => ({ backgroundColor: c.warning === "#fbbf24" ? "#3b3020" : "#fff4dd" }), alertTitle: c => ({ color: c.warning }), alertCopy: c => ({ color: c.warning }),
  deliveriesButton: c => ({ backgroundColor: c.accentSoft }), deliveriesTitle: c => ({ color: c.accent }), deliveriesCopy: c => ({ color: c.text }),
  cashCard: c => ({ backgroundColor: c.surface, borderColor: c.border }), cashEyebrow: c => ({ color: c.accent }), cashHeading: c => ({ color: c.text }),
  balance: c => ({ color: c.accent }), balanceLabel: c => ({ color: c.muted }), cashRow: c => ({ borderTopColor: c.border }),
  cashLabel: c => ({ color: c.text }), cashValue: c => ({ color: c.text }), primary: c => ({ backgroundColor: c.accent }), note: c => ({ color: c.muted }),
};
const styles = new Proxy(baseStyles, { get(target, key) {
  if (typeof key !== "string") return target[key];
  const override = styleColors[key]?.(dashboardPalette);
  return override ? [target[key], override] : target[key];
}});
