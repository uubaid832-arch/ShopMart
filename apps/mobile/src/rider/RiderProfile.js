import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import ProfileModal from "../account/ProfileModal";
import ChangePasswordModal from "../account/ChangePasswordModal";
import BiometricSettingsModal from "../account/BiometricSecurity";

const paths = {
  user: "M20 21v-2a8 8 0 0 0-16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4",
  fingerprint:
    "M3 10a9 9 0 0 1 18 0M6 11a6 6 0 0 1 12 0v3m-9-3a3 3 0 0 1 6 0v3c0 4-1 6-3 8M12 11v3c0 3-1 6-3 8M6 14c0 3-1 5-2 6m14-3c0 2-.5 3-1 4",
  arrow: "m9 5 7 7-7 7",
};
function Icon({ name, color = "#8d5cc2", size = 22 }) {
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
export default function RiderProfile({
  session,
  onUpdateUser,
  onPasswordChanged,
  security,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [biometricOpen, setBiometricOpen] = useState(false);
  const user = session.user;
  const actions = [
    {
      icon: "user",
      title: "Personal details",
      description: "Update your name and phone number",
      action: () => setProfileOpen(true),
      disabled: typeof onUpdateUser !== "function",
    },
    {
      icon: "lock",
      title: "Change password",
      description: "Protect your rider account",
      action: () => setPasswordOpen(true),
      disabled: typeof onPasswordChanged !== "function",
    },
    {
      icon: "fingerprint",
      title: "Fingerprint & security",
      description: security?.enabled
        ? "Biometric unlock is enabled on this device"
        : "Enable biometric unlock on this device",
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
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.role}>
            <Text style={styles.roleText}>RIDER ACCOUNT</Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Account settings</Text>
        <Text style={styles.sectionCaption}>
          Your details and security, in one place.
        </Text>
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
            <Icon name="arrow" size={17} color="#c1acd0" />
          </Pressable>
        ))}
        <View style={styles.info}>
          <Text style={styles.infoTitle}>Keep your account safe</Text>
          <Text style={styles.description}>
            Never share your password or email verification code. Changing your
            password requires signing in again. Your phone handles biometric
            verification.
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
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 35 },
  profileCard: {
    padding: 23,
    borderRadius: 24,
    backgroundColor: "#f3ebfc",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e9dcf7",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: "#e2d2f4",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 32, fontWeight: "800", color: "#8f54c5" },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: "#49314f",
    textAlign: "center",
    marginTop: 15,
  },
  email: { fontSize: 12, color: "#82718b", marginTop: 7, textAlign: "center" },
  role: {
    backgroundColor: "#eaddf9",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 14,
  },
  roleText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#a17bb8",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#49314f",
    marginTop: 27,
  },
  sectionCaption: {
    fontSize: 11,
    color: "#82718b",
    marginTop: 5,
    marginBottom: 17,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#eee3f5",
    borderRadius: 18,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#f5edfc",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  actionTitle: { color: "#5e466c", fontSize: 13, fontWeight: "700" },
  description: { color: "#82718b", fontSize: 11, lineHeight: 19, marginTop: 5 },
  info: {
    padding: 18,
    backgroundColor: "#f7f3fb",
    borderRadius: 18,
    marginTop: 12,
  },
  infoTitle: { color: "#725481", fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.45 },
});
