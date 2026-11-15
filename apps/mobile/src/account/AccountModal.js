import { Text } from "../i18n/LocalizedNativeComponents.js";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useMobileAppearance } from "../appearance/MobileAppearance";

const paths = {
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
  arrow: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  mail: "M3 5h18v14H3V5Zm0 0 9 8 9-8",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4",
  languages: "M4 5h12M10 3v2m4 0c-.6 4-3.2 7-7 9m-3-5c2.3 3.4 5 5.4 9 7M14 20l4-9 4 9m-6.7-3h5.4",
  palette: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a1.5 1.5 0 0 1 0-3h3a6 6 0 0 0 6-6c0-2.8-4-5-9-5ZM7.5 10h.01M10 6.5h.01M15 6.5h.01M17.5 10h.01",
};

function Icon({ name, color = "#7c3aed", size = 21 }) {
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
export default function AccountModal({
  session,
  busy,
  error,
  onEditProfile,
  onChangePassword,
  onOpenBiometrics,
  language = "en",
  onToggleLanguage,
  onAppearance,
  onSignOut,
  onClose,
}) {
  const user = session.user;
  const { theme } = useMobileAppearance();
  const palette = theme.colors;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <ScrollView style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }]} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View>
              <Text style={[styles.eyebrow, { color: palette.muted }]}>YOUR SHOPMART SPACE</Text>
              <Text style={[styles.title, { color: palette.text }]}>My account</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close account"
              onPress={onClose}
              style={[styles.closeIcon, { backgroundColor: palette.soft }]}
            >
              <Icon name="close" color={palette.muted} />
            </Pressable>
          </View>

          <View style={[styles.profile, { backgroundColor: palette.accentSoft }]}>
            <View style={[styles.avatar, { backgroundColor: palette.surface, borderColor: palette.surface }]}>
              <Text style={[styles.initial, { color: palette.accent }]}>
                {user.name?.trim().charAt(0).toUpperCase() || "S"}
              </Text>
            </View>

            <Text style={[styles.name, { color: palette.text }]}>{user.name}</Text>

            <View style={styles.emailRow}>
              <Icon name="mail" size={15} color={palette.muted} />
              <Text style={[styles.email, { color: palette.muted }]}>{user.email}</Text>
            </View>

            <View style={[styles.roleBadge, { backgroundColor: palette.surface }]}>
              <Text style={[styles.role, { color: palette.accent }]}>
                {String(user.role || "Customer").toLowerCase()}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: palette.muted }]}>ACCOUNT SETTINGS</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change app language. Current language: ${language === "ur" ? "Urdu" : "English"}`}
            onPress={onToggleLanguage}
            style={({ pressed }) => [styles.action, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: palette.accentSoft }]}>
              <Icon name="languages" color={palette.accent} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.text }]}>App language</Text>
              <Text style={[styles.actionDescription, { color: palette.muted }]}>
                {language === "ur" ? "ابھی اردو منتخب ہے" : "English is selected"}
              </Text>
            </View>
            <View style={[styles.languagePill, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.languagePillText, { color: palette.accent }]}>{language === "ur" ? "English" : "اردو"}</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onAppearance}
            style={({ pressed }) => [styles.action, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: palette.accentSoft }]}>
              <Icon name="palette" color={palette.accent} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.text }]}>Appearance</Text>
              <Text style={[styles.actionDescription, { color: palette.muted }]}>Change theme and accent colour</Text>
            </View>
            <Icon name="arrow" size={17} color={palette.muted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onEditProfile}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: palette.surface, borderColor: palette.border },
              pressed && styles.pressed,
              busy && styles.dim,
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: palette.accentSoft }]}>
              <Icon name="edit" color={palette.accent} />
            </View>

            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.text }]}>Edit profile</Text>
              <Text style={[styles.actionDescription, { color: palette.muted }]}>
                Update your name and phone number
              </Text>
            </View>

            <Icon name="arrow" size={17} color={palette.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onChangePassword}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: palette.surface, borderColor: palette.border },
              pressed && styles.pressed,
              busy && styles.dim,
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: palette.accentSoft }]}>
              <Icon name="lock" color={palette.accent} />
            </View>

            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.text }]}>Change password</Text>
              <Text style={[styles.actionDescription, { color: palette.muted }]}>
                Keep your account secure
              </Text>
            </View>

            <Icon name="arrow" size={17} color={palette.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onOpenBiometrics}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: palette.surface, borderColor: palette.border },
              pressed && styles.pressed,
              busy && styles.dim,
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: palette.accentSoft }]}>
              <Icon name="lock" color={palette.accent} />
            </View>

            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.text }]}>Fingerprint & security</Text>
              <Text style={[styles.actionDescription, { color: palette.muted }]}>
                Manage biometric app unlock
              </Text>
            </View>

            <Icon name="arrow" size={17} color={palette.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: theme.isDark ? palette.surface : "#fffcfd", borderColor: theme.isDark ? palette.border : "#f8e8ec" },
              pressed && styles.pressed,
              busy && styles.dim,
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: theme.isDark ? "#3b202b" : "#fff0f3" }]}>
              <Icon name="logout" color={palette.danger} />
            </View>

            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, { color: palette.danger }]}>
                {busy ? "Signing out..." : "Sign out"}
              </Text>
              <Text style={[styles.actionDescription, { color: palette.muted }]}>
                Sign out of ShopMart on this device
              </Text>
            </View>

            <Icon name="arrow" size={17} color={palette.danger} />
          </Pressable>

          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: palette.accent }]}
          >
            <Text style={styles.closeText}>Continue shopping</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20, 24, 46, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 28,
    borderWidth: 1,
    maxHeight: "94%",
  },
  sheetContent: { padding: 22 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  eyebrow: {
    color: "#a093b9",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#202741",
    marginTop: 6,
    letterSpacing: -0.6,
  },
  closeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f6f4fa",
    alignItems: "center",
    justifyContent: "center",
  },
  profile: {
    backgroundColor: "#f5f1ff",
    borderRadius: 22,
    padding: 21,
    alignItems: "center",
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#e5dafa",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  initial: { fontSize: 29, fontWeight: "800", color: "#7c3aed" },
  name: {
    color: "#27304a",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 13,
    textAlign: "center",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  email: {
    color: "#8b83a5",
    fontSize: 12,
    flexShrink: 1,
    textAlign: "center",
  },
  roleBadge: {
    backgroundColor: "#e9e0fb",
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 13,
  },
  role: {
    color: "#7951b0",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  sectionLabel: {
    color: "#a0a5b5",
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: "#ece8f5",
    borderRadius: 16,
    marginBottom: 10,
  },
  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#f1ebfc",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: "#35405a", fontSize: 14, fontWeight: "700" },
  actionDescription: {
    color: "#969cad",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },
  languagePill: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
  languagePillText: { fontSize: 11, fontWeight: "800" },
  logoutAction: { borderColor: "#f8e8ec", backgroundColor: "#fffcfd" },
  logoutIcon: { backgroundColor: "#fff0f3" },
  logoutText: { color: "#d14b68" },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.45 },
  closeButton: {
    padding: 15,
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    marginTop: 10,
  },
  closeText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 13,
  },
  error: { color: "#be123c", fontSize: 12, lineHeight: 20, marginVertical: 8 },
});
