import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const paths = {
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
  arrow: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  mail: "M3 5h18v14H3V5Zm0 0 9 8 9-8",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4",
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
  onSignOut,
  onClose,
}) {
  const user = session.user;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>YOUR SHOPMART SPACE</Text>
              <Text style={styles.title}>My account</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close account"
              onPress={onClose}
              style={styles.closeIcon}
            >
              <Icon name="close" color="#7c859b" />
            </Pressable>
          </View>

          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.initial}>
                {user.name?.trim().charAt(0).toUpperCase() || "S"}
              </Text>
            </View>

            <Text style={styles.name}>{user.name}</Text>

            <View style={styles.emailRow}>
              <Icon name="mail" size={15} color="#8b83a5" />
              <Text style={styles.email}>{user.email}</Text>
            </View>

            <View style={styles.roleBadge}>
              <Text style={styles.role}>
                {String(user.role || "Customer").toLowerCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>ACCOUNT SETTINGS</Text>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onEditProfile}
            style={({ pressed }) => [
              styles.action,
              pressed && styles.pressed,
              busy && styles.dim,
            ]}
          >
            <View style={styles.actionIcon}>
              <Icon name="edit" />
            </View>

            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Edit profile</Text>
              <Text style={styles.actionDescription}>
                Update your name and phone number
              </Text>
            </View>

            <Icon name="arrow" size={17} color="#a49ab9" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onChangePassword}
            style={({ pressed }) => [
              styles.action,
              pressed && styles.pressed,
              busy && styles.dim,
            ]}
          >
            <View style={styles.actionIcon}>
              <Icon name="lock" />
            </View>

            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Change password</Text>
              <Text style={styles.actionDescription}>
                Keep your account secure
              </Text>
            </View>

            <Icon name="arrow" size={17} color="#a49ab9" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.action,
              styles.logoutAction,
              pressed && styles.pressed,
              busy && styles.dim,
            ]}
          >
            <View style={[styles.actionIcon, styles.logoutIcon]}>
              <Icon name="logout" color="#e05270" />
            </View>

            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, styles.logoutText]}>
                {busy ? "Signing out..." : "Sign out"}
              </Text>
              <Text style={styles.actionDescription}>
                Sign out of ShopMart on this device
              </Text>
            </View>

            <Icon name="arrow" size={17} color="#d7a1ad" />
          </Pressable>

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>Continue shopping</Text>
          </Pressable>
        </View>
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
    padding: 22,
  },
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
