import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

async function profileRequest(token, values, signal) {
  const response = await fetch(`${baseUrl}/api/mobile/profile`, {
    method: values ? "PATCH" : "GET",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(values && { "Content-Type": "application/json" }),
    },
    body: values ? JSON.stringify(values) : undefined,
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Your session expired. Please sign in again."
        : response.status === 400
          ? "Check your name and phone number."
          : "Could not update your profile. Please try again.",
    );
  }

  return response.json();
}

export default function ProfileModal({ session, onSaved, onClose }) {
  const token = session.accessToken;
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    profileRequest(token, undefined, controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) {
          setProfile(user);
          setName(user.name || "");
          setPhone(user.phone || "");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, reload]);

  function close() {
    if (!pending.current) onClose();
  }

  async function save() {
    if (pending.current || loading || !profile) return;

    if (!name.trim() || name.trim().length > 150) {
      setError("Enter a name of up to 150 characters.");
      return;
    }

    if (phone.trim() && !/^[0-9]{11}$/.test(phone.trim())) {
      setError("Enter an 11-digit phone number or leave it empty.");
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const user = await profileRequest(token, {
        name: name.trim(),
        phone: phone.trim(),
      });

      setProfile(user);
      setName(user.name);
      setPhone(user.phone || "");
      onSaved(user);
      setNotice("Profile updated successfully.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

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
              <Text style={styles.title}>My profile</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={close}
                style={styles.close}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color="#7c3aed" />
            ) : profile ? (
              <>
                <View style={styles.profileCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.initial}>
                      {profile.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  <Text style={styles.email}>{profile.email}</Text>
                </View>

                <Text style={styles.label}>Full name</Text>
                <TextInput
                  accessibilityLabel="Full name"
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    setNotice("");
                  }}
                  editable={!busy}
                  maxLength={150}
                  autoCapitalize="words"
                  autoComplete="name"
                  style={styles.input}
                />

                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  accessibilityLabel="Phone number"
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value.replace(/\D/g, ""));
                    setNotice("");
                  }}
                  editable={!busy}
                  maxLength={11}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="03XXXXXXXXX"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />

                <Text style={styles.hint}>
                  Your email is used for sign-in and verification and cannot be
                  changed here.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={save}
                  style={[styles.save, busy && styles.disabled]}
                >
                  <Text style={styles.saveText}>
                    {busy ? "Saving..." : "Save changes"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setReload((value) => value + 1)}
                style={styles.close}
              >
                <Text style={styles.link}>Retry loading profile</Text>
              </Pressable>
            )}

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
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
    marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#17203c" },
  close: { padding: 13, backgroundColor: "#f3effd", borderRadius: 12 },
  link: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },
  profileCard: {
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#f5f1ff",
    alignItems: "center",
    marginBottom: 25,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e6dcfb",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 30, fontWeight: "800", color: "#7c3aed" },
  profileName: {
    fontSize: 21,
    fontWeight: "800",
    color: "#25304a",
    marginTop: 15,
    textAlign: "center",
  },
  email: { color: "#7c859b", marginTop: 7, fontSize: 13 },
  label: { fontWeight: "700", color: "#475569", marginBottom: 9 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 15,
    backgroundColor: "#fafbff",
    color: "#25304a",
    fontSize: 15,
    marginBottom: 22,
  },
  hint: { color: "#94a3b8", fontSize: 12, lineHeight: 20 },
  save: {
    backgroundColor: "#7c3aed",
    padding: 17,
    borderRadius: 14,
    marginTop: 24,
  },
  saveText: { color: "#fff", textAlign: "center", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  error: { color: "#be123c", lineHeight: 22, marginTop: 18 },
  notice: { color: "#15803d", lineHeight: 22, marginTop: 18 },
});
