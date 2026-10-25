import { useEffect, useRef, useState } from "react";
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
import { registerMobileAccount, resendMobileSignIn } from "./useMobileSession";
import ForgotPasswordModal from "./ForgotPasswordModal";

export default function AuthModal({ onSignIn, onVerify, onClose }) {
  const [registering, setRegistering] = useState(false);
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmation: "",
    code: "",
  });
  const [challenge, setChallenge] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  const expired = challenge && now >= Date.parse(challenge.expiresAt);
  const wait = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now) / 1000))
    : 0;

  function close() {
    if (!pending.current) onClose();
  }

  function update(name, value) {
    setValues((current) => ({
      ...current,
      [name]: name === "code" ? value.replace(/\D/g, "").slice(0, 6) : value,
    }));
    setError("");
    setNotice("");
  }

  function restart() {
    if (pending.current) return;
    setChallenge(null);
    setRegistering(false);
    setError("");
    setNotice("");
    setValues((current) => ({
      ...current,
      password: "",
      confirmation: "",
      code: "",
    }));
  }

  async function submit() {
    if (pending.current) return;
    const email = values.email.trim();
    if (challenge) {
      if (
        !/^\d{6}$/.test(values.code) ||
        Date.now() >= Date.parse(challenge.expiresAt)
      ) {
        setError(
          "Enter a valid six-digit code before it expires. Start a new sign-in if expired.",
        );
        return;
      }
      if (typeof onVerify !== "function") {
        setError("Connect onVerify={auth.verifySignIn} in App.js first.");
        return;
      }
    } else {
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
    }
    pending.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (challenge) {
        await onVerify({
          challengeId: challenge.challengeId,
          code: values.code,
        });
        onClose();
      } else if (registering) {
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
        const result = await onSignIn({ email, password: values.password });
        if (result?.requiresOtp) {
          setChallenge(result);
          setNow(Date.now());
          setValues((current) => ({
            ...current,
            password: "",
            confirmation: "",
            code: "",
          }));
          setNotice(
            "A verification code was sent to your email. Check your inbox and spam folder.",
          );
        } else {
          onClose();
        }
      }
    } catch (failure) {
      setError(failure.message || "Could not complete the request.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  async function resend() {
    if (pending.current || !challenge || wait > 0 || expired) return;
    pending.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await resendMobileSignIn(challenge.challengeId);
      setChallenge(result);
      setNow(Date.now());
      setValues((current) => ({ ...current, code: "" }));
      setNotice("A new code was sent. Use the most recent email.");
    } catch (failure) {
      setError(failure.message || "Could not resend the code.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const fields = challenge
    ? [{ name: "code", label: "Email verification code" }]
    : [
        ...(registering ? [{ name: "name", label: "Full name" }] : []),
        { name: "email", label: "Email address" },
        { name: "password", label: "Password" },
        ...(registering
          ? [{ name: "confirmation", label: "Confirm password" }]
          : []),
      ];

  if (forgotOpen)
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
              {challenge
                ? "Verify your sign-in"
                : registering
                  ? "Create your account"
                  : "Welcome back"}
            </Text>
            <Text style={styles.description}>
              {challenge
                ? `Enter the code sent to ${values.email.trim()}. Rider and admin sign-in requires verification.`
                : registering
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
                      name === "code"
                        ? "number-pad"
                        : name === "email"
                          ? "email-address"
                          : "default"
                    }
                    autoComplete={
                      name === "code"
                        ? "one-time-code"
                        : name === "name"
                          ? "name"
                          : name === "email"
                            ? "email"
                            : registering
                              ? "new-password"
                              : "current-password"
                    }
                    maxLength={
                      name === "code"
                        ? 6
                        : name === "name"
                          ? 150
                          : name === "email"
                            ? 254
                            : 72
                    }
                    style={styles.input}
                  />
                </View>
              );
            })}
            {expired && (
              <Text style={styles.error}>
                Code expired. Start a new sign-in below.
              </Text>
            )}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={saving || Boolean(expired)}
              onPress={submit}
              style={[styles.primary, (saving || expired) && styles.disabled]}
            >
              <Text style={styles.primaryText}>
                {saving
                  ? "Please wait..."
                  : challenge
                    ? "Verify & sign in"
                    : registering
                      ? "Create account"
                      : "Sign in"}
              </Text>
            </Pressable>
            {challenge ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || wait > 0 || Boolean(expired)}
                  onPress={resend}
                  style={styles.switch}
                >
                  <Text style={styles.switchText}>
                    {expired
                      ? "Code expired"
                      : wait > 0
                        ? `Resend code in ${wait}s`
                        : "Resend code"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={restart}
                  style={styles.switch}
                >
                  <Text style={styles.switchText}>Start a new sign-in</Text>
                </Pressable>
              </>
            ) : (
              <>
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
                    setRegistering((value) => !value);
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
              </>
            )}
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
