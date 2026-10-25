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
import { registerMobileAccount } from "./useMobileSession";
import ForgotPasswordModal from "./ForgotPasswordModal";
export default function AuthModal({ onSignIn, onClose }) {
  const [registering, setRegistering] = useState(false);
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const pending = useRef(false);

  function close() {
    if (!pending.current) onClose();
  }

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setError("");
    setNotice("");
  }

  async function submit() {
    if (pending.current) return;

    const email = values.email.trim();

    if (!email || !values.password || (registering && !values.name.trim())) {
      setError("Please complete all required fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (
      registering &&
      (values.password.length < 8 || values.password !== values.confirmation)
    ) {
      setError("Use at least 8 password characters and matching passwords.");
      return;
    }

    pending.current = true;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (registering) {
        await registerMobileAccount({
          name: values.name.trim(),
          email,
          password: values.password,
        });

        setRegistering(false);
        setValues((current) => ({
          ...current,
          password: "",
          confirmation: "",
        }));
        setNotice("Account created. You can now sign in.");
      } else {
        await onSignIn({ email, password: values.password });
        onClose();
      }
    } catch (failure) {
      setError(failure.message || "Could not complete the request.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const fields = [
    ...(registering ? [{ name: "name", label: "Full name" }] : []),
    { name: "email", label: "Email address" },
    { name: "password", label: "Password" },
    ...(registering
      ? [{ name: "confirmation", label: "Confirm password" }]
      : []),
  ];
  if (forgotOpen) {
    return (
      <ForgotPasswordModal
        initialEmail={values.email}
        onClose={() => {
          setForgotOpen(false);
          setValues((current) => ({
            ...current,
            password: "",
            confirmation: "",
          }));
          setError("");
          setNotice("");
        }}
      />
    );
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
              <Text style={styles.brand}>ShopMart account</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close sign-in"
                disabled={saving}
                onPress={close}
                style={styles.close}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>
              {registering ? "Create your account" : "Welcome back"}
            </Text>
            <Text style={styles.description}>
              {registering
                ? "Join ShopMart to manage your orders."
                : "Sign in using your existing ShopMart account."}
            </Text>

            {fields.map(({ name, label }) => {
              const password = name === "password" || name === "confirmation";

              return (
                <View key={name} style={styles.field}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    accessibilityLabel={label}
                    value={values[name]}
                    onChangeText={(value) => update(name, value)}
                    editable={!saving}
                    secureTextEntry={password}
                    autoCapitalize={name === "name" ? "words" : "none"}
                    autoCorrect={false}
                    keyboardType={
                      name === "email" ? "email-address" : "default"
                    }
                    autoComplete={
                      name === "name"
                        ? "name"
                        : name === "email"
                          ? "email"
                          : registering
                            ? "new-password"
                            : "current-password"
                    }
                    maxLength={
                      name === "name" ? 150 : name === "email" ? 254 : 72
                    }
                    style={styles.input}
                  />
                </View>
              );
            })}

            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={submit}
              style={[styles.primary, saving && styles.disabled]}
            >
              <Text style={styles.primaryText}>
                {saving
                  ? "Please wait…"
                  : registering
                    ? "Create account"
                    : "Sign in"}
              </Text>
            </Pressable>
            {!registering && (
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setForgotOpen(true)}
                style={styles.switch}
              >
                <Text style={styles.switchText}>Forgot password?</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                setRegistering((current) => !current);
                setError("");
                setNotice("");
                setValues((current) => ({
                  ...current,
                  password: "",
                  confirmation: "",
                }));
              }}
              style={styles.switch}
            >
              <Text style={styles.switchText}>
                {registering
                  ? "Already registered? Sign in"
                  : "New to ShopMart? Create an account"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  brand: { color: "#7c3aed", fontWeight: "800", fontSize: 15 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 28, color: "#64748b" },
  title: { fontSize: 29, fontWeight: "800", color: "#0f172a" },
  description: {
    marginTop: 10,
    marginBottom: 28,
    color: "#64748b",
    lineHeight: 22,
  },
  field: { marginBottom: 18 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: "700", color: "#334155" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: "#0f172a",
  },
  primary: {
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  switch: { paddingVertical: 20 },
  switchText: { color: "#7c3aed", textAlign: "center", fontWeight: "600" },
  disabled: { opacity: 0.5 },
  error: { color: "#be123c", marginBottom: 14, lineHeight: 21 },
  notice: { color: "#047857", marginBottom: 14, lineHeight: 21 },
});
