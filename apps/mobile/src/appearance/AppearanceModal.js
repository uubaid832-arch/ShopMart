import { Text } from "../i18n/LocalizedNativeComponents.js";
import { Modal, Pressable, ScrollView, StyleSheet, Text as NativeText, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMobileAppearance } from "./MobileAppearance";

const modes = [
  { id: "light", title: "Light", symbol: "☀" },
  { id: "dark", title: "Dark", symbol: "☾" },
  { id: "system", title: "System", symbol: "◐" },
];

const accents = [
  { id: "violet", title: "Violet", color: "#7c3aed" },
  { id: "blue", title: "Blue", color: "#2563eb" },
  { id: "green", title: "Green", color: "#15803d" },
  { id: "orange", title: "Orange", color: "#c2410c" },
];

export default function AppearanceModal({ visible, onClose }) {
  const { mode, accent, isDark, colors, updatePreferences } = useMobileAppearance();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={[styles.eyebrow, { color: colors.accent }]}>MAKE IT YOURS</Text>
                <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>Choose how ShopMart looks on this device.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close appearance" onPress={onClose} style={[styles.close, { backgroundColor: colors.soft }]}>
                <Text style={[styles.closeText, { color: colors.text }]}>×</Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Display mode</Text>
            <View style={styles.modeRow}>
              {modes.map((item) => {
                const selected = mode === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => updatePreferences({ mode: item.id })}
                    style={[styles.mode, { backgroundColor: selected ? colors.accentSoft : colors.soft, borderColor: selected ? colors.accent : colors.border }]}
                  >
                    <Text style={[styles.modeSymbol, { color: selected ? colors.accent : colors.muted }]}>{item.symbol}</Text>
                    <Text style={[styles.modeText, { color: selected ? colors.accent : colors.text }]}>{item.title}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, styles.accentHeading, { color: colors.text }]}>Accent colour</Text>
            <View style={styles.accentRow}>
              {accents.map((item) => {
                const selected = accent === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${item.title} accent colour`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => updatePreferences({ accent: item.id })}
                    style={[styles.accentChoice, { backgroundColor: selected ? colors.accentSoft : colors.soft, borderColor: selected ? colors.accent : colors.border }]}
                  >
                    <View style={[styles.swatch, { backgroundColor: item.color }, selected && styles.selectedSwatch]} />
                    <Text style={[styles.accentText, { color: selected ? colors.accent : colors.text }]}>{item.title}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.info, { backgroundColor: colors.soft }]}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>{mode === "system" ? `Following your device’s ${isDark ? "dark" : "light"} mode` : `${mode === "dark" ? "Dark" : "Light"} mode selected`}</Text>
              <Text style={[styles.infoText, { color: colors.muted }]}>Your choice is saved automatically on this device.</Text>
            </View>

            <Pressable accessibilityRole="button" onPress={() => updatePreferences({ mode: "system", accent: "violet" })} style={[styles.reset, { borderColor: colors.border }]}>
              <Text style={[styles.resetText, { color: colors.accent }]}>↺  Reset appearance</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 18 },
  panel: { borderWidth: 1, borderRadius: 26, padding: 22, gap: 11 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { fontSize: 27, fontWeight: "900", letterSpacing: -0.7, marginTop: 6 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  close: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  closeText: { fontSize: 27, lineHeight: 30 },
  sectionTitle: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  modeRow: { flexDirection: "row", gap: 8 },
  mode: { flex: 1, minHeight: 84, paddingVertical: 11, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 7 },
  modeSymbol: { fontSize: 23 },
  modeText: { fontSize: 12, fontWeight: "800" },
  accentHeading: { marginTop: 15 },
  accentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  accentChoice: { flexGrow: 1, flexBasis: "45%", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 9, borderRadius: 14, borderWidth: 1 },
  swatch: { width: 17, height: 17, borderRadius: 9 },
  selectedSwatch: { borderWidth: 2, borderColor: "#ffffff" },
  accentText: { fontSize: 12, fontWeight: "700" },
  info: { marginTop: 10, padding: 14, borderRadius: 15, gap: 4 },
  infoTitle: { fontSize: 13, fontWeight: "800" },
  infoText: { fontSize: 11, lineHeight: 17 },
  reset: { marginTop: 3, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  resetText: { fontWeight: "800", fontSize: 13 },
});
