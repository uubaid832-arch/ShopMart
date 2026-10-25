import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export default function ChangePasswordModal({ session, onChanged, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function finish() {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError("");

    try {
      await onChanged();
    } catch {
      setError("Password changed. Tap Sign in again to finish signing out.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function close() {
    if (pending.current) return;
    if (changed) finish();
    else onClose();
  }

  async function save() {
    if (pending.current || changed) return;

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    if (
      newPassword.length < 8 ||
      newPassword.length > 72 ||
      newPassword !== confirmation
    ) {
      setError("Use 8–72 characters and matching new passwords.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("Choose a different password from your current password.");
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${baseUrl}/api/mobile/profile/password`, {
        method: "PATCH",
        credentials: "omit",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 400
            ? "Current password is incorrect, or the new password is invalid. Use a different password of 8–72 characters."
            : response.status === 401
              ? "Your session expired. Please sign in again."
              : "Could not confirm the change. Try signing in with the new password before retrying.",
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setChanged(true);
    } catch (failure) {
      setError(
        failure.message ||
          "Could not confirm the change. Check your connection.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const fields = [
    ["Current password", currentPassword, setCurrentPassword],
    ["New password", newPassword, setNewPassword],
    ["Confirm new password", confirmation, setConfirmation],
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Change password</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={close}
                style={styles.close}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>

            {changed ? (
              <>
                <View style={styles.success}>
                  <Text style={styles.successTitle}>Password updated</Text>
                  <Text style={styles.description}>
                    Sign in again using your new password.
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={finish}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>
                    {busy ? "Please wait..." : "Sign in again"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.description}>
                  Enter your current password and choose a new one.
                </Text>

                {fields.map(([label, value, change], index) => (
                  <View key={label} style={styles.field}>
                    <Text style={styles.label}>{label}</Text>
                    <TextInput
                      accessibilityLabel={label}
                      value={value}
                      onChangeText={(text) => {
                        change(text);
                        setError("");
                      }}
                      editable={!busy}
                      secureTextEntry={!visible}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={
                        index === 0 ? "current-password" : "new-password"
                      }
                      maxLength={72}
                      style={styles.input}
                    />
                  </View>
                ))}

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setVisible((value) => !value)}
                  style={styles.visibility}
                >
                  <Text style={styles.link}>
                    {visible ? "Hide passwords" : "Show passwords"}
                  </Text>
                </Pressable>

                <Text style={styles.hint}>
                  Use 8–72 characters. Existing refresh sessions will be revoked
                  after the change.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={save}
                  style={[styles.primary, busy && styles.disabled]}
                >
                  <Text style={styles.primaryText}>
                    {busy ? "Updating..." : "Update password"}
                  </Text>
                </Pressable>
              </>
            )}

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 22, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 20,
  },
  title: { flex: 1, fontSize: 23, fontWeight: "800", color: "#25304a" },
  close: { padding: 13, backgroundColor: "#f3effd", borderRadius: 12 },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  description: { color: "#7c859b", lineHeight: 22, fontSize: 13 },
  field: { marginTop: 22 },
  label: { color: "#475569", fontWeight: "700", marginBottom: 9 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 15,
    color: "#25304a",
    backgroundColor: "#fafbff",
    fontSize: 15,
  },
  visibility: { paddingVertical: 16, alignSelf: "flex-end" },
  hint: { color: "#94a3b8", fontSize: 12, lineHeight: 21 },
  primary: {
    padding: 17,
    borderRadius: 14,
    backgroundColor: "#7c3aed",
    marginTop: 24,
  },
  primaryText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.5 },
  success: { backgroundColor: "#ecfdf5", padding: 20, borderRadius: 18 },
  successTitle: {
    color: "#15803d",
    fontWeight: "800",
    fontSize: 21,
    marginBottom: 10,
  },
  error: { color: "#be123c", lineHeight: 22, marginTop: 18 },
});
