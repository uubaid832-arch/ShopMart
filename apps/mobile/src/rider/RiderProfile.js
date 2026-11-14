import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import ProfileModal from "../account/ProfileModal";
import ChangePasswordModal from "../account/ChangePasswordModal";
import BiometricSettingsModal from "../account/BiometricSecurity";
import { useMobileAppearance } from "../appearance/MobileAppearance";

let profilePalette = null;

const paths = {
  user: "M20 21v-2a8 8 0 0 0-16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4",
  fingerprint:
    "M3 10a9 9 0 0 1 18 0M6 11a6 6 0 0 1 12 0v3m-9-3a3 3 0 0 1 6 0v3c0 4-1 6-3 8M12 11v3c0 3-1 6-3 8M6 14c0 3-1 5-2 6m14-3c0 2-.5 3-1 4",
  arrow: "m9 5 7 7-7 7",
};
function Icon({ name, color, size = 22 }) {
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
export default function RiderProfile({
  session,
  onUpdateUser,
  onPasswordChanged,
  security,
}) {
  const { theme } = useMobileAppearance();
  profilePalette = theme.colors;
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [biometricOpen, setBiometricOpen] = useState(false);
  const user = session.user;
  const actions = [
    {
      icon: "user",
      title: "My name and phone",
      description: "Change your contact details",
      action: () => setProfileOpen(true),
      disabled: typeof onUpdateUser !== "function",
    },
    {
      icon: "lock",
      title: "Change my password",
      description: "Use a new password to sign in",
      action: () => setPasswordOpen(true),
      disabled: typeof onPasswordChanged !== "function",
    },
    {
      icon: "fingerprint",
      title: "Fingerprint lock",
      description: security?.enabled
        ? "On for this phone"
        : "Turn on fingerprint sign-in",
      action: () => setBiometricOpen(true),
      disabled: !security,
    },
  ];
  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>
              {user.name?.trim().charAt(0).toUpperCase() || "R"}
            </Text>
          </View>
        <Text style={styles.name}>{user.name || "Rider"}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.role}>
            <Text style={styles.roleText}>RIDER ACCOUNT</Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>My account</Text>
        <Text style={styles.sectionCaption}>Choose what you want to change.</Text>
        {actions.map((item) => (
          <Pressable
            key={item.icon}
            accessibilityRole="button"
            disabled={item.disabled}
            onPress={item.action}
            style={({ pressed }) => [
              styles.action,
              pressed && styles.pressed,
              item.disabled && styles.dim,
            ]}
          >
            <View style={styles.icon}>
              <Icon name={item.icon} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.actionTitle}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
            <Icon name="arrow" size={17} color={theme.colors.muted} />
          </Pressable>
        ))}
        <View style={styles.info}>
          <Text style={styles.infoTitle}>Keep your account safe</Text>
          <Text style={styles.description}>
            Do not tell anyone your password or email code. Keep your phone with you.
          </Text>
        </View>
      </ScrollView>
      {profileOpen && (
        <ProfileModal
          key={user.id}
          session={session}
          onSaved={onUpdateUser}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {passwordOpen && (
        <ChangePasswordModal
          session={session}
          onClose={() => setPasswordOpen(false)}
          onChanged={onPasswordChanged}
        />
      )}
      {biometricOpen && security && (
        <BiometricSettingsModal
          security={security}
          onClose={() => setBiometricOpen(false)}
          onLock={() => {
            setBiometricOpen(false);
            security.lockNow();
          }}
        />
      )}
    </>
  );
}
const baseStyles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 32 },
  profileCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#e9e5fb",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d8cff5",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#d8cff5",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 32, fontWeight: "900", color: "#3f2e91" },
  name: {
    fontSize: 23,
    fontWeight: "900",
    color: "#182235",
    textAlign: "center",
    marginTop: 15,
  },
  email: { fontSize: 14, color: "#334155", marginTop: 7, textAlign: "center" },
  role: {
    backgroundColor: "#d8cff5",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 14,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#3f2e91",
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#182235",
    marginTop: 27,
  },
  sectionCaption: {
    fontSize: 14,
    color: "#3d485a",
    marginTop: 5,
    marginBottom: 17,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dfe4ed",
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#ece9fb",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  actionTitle: { color: "#182235", fontSize: 15, fontWeight: "900" },
  description: { color: "#3d485a", fontSize: 13, lineHeight: 20, marginTop: 5 },
  info: {
    padding: 18,
    backgroundColor: "#eef0f4",
    borderRadius: 18,
    marginTop: 12,
  },
  infoTitle: { color: "#182235", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.45 },
});
const styleColors = {
  content: c => ({ backgroundColor: c.background }), profileCard: c => ({ backgroundColor: c.accentSoft, borderColor: c.border }),
  avatar: c => ({ backgroundColor: c.soft, borderColor: c.surface }), initial: c => ({ color: c.accent }), name: c => ({ color: c.text }), email: c => ({ color: c.muted }),
  role: c => ({ backgroundColor: c.soft }), roleText: c => ({ color: c.accent }), sectionTitle: c => ({ color: c.text }), sectionCaption: c => ({ color: c.muted }),
  action: c => ({ backgroundColor: c.surface, borderColor: c.border }), icon: c => ({ backgroundColor: c.accentSoft }),
  actionTitle: c => ({ color: c.text }), description: c => ({ color: c.muted }), info: c => ({ backgroundColor: c.soft }), infoTitle: c => ({ color: c.text }),
};
const styles = new Proxy(baseStyles, { get(target, key) {
  if (typeof key !== "string") return target[key];
  const override = styleColors[key]?.(profilePalette);
  return override ? [target[key], override] : target[key];
}});
