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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

async function request(action, values) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");

  const response = await fetch(
    `${baseUrl}/api/mobile/auth/password/${action}`,
    {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    },
  );

  if (!response.ok) {
    const messages = {
      400:
        action === "reset"
          ? "Invalid or expired code, or invalid password. Use a different password with 8–72 characters."
          : "Check your details or request a new code.",
      429: "Too many attempts. Wait before trying again.",
      503: "Email delivery is unavailable. Please try again later.",
    };

    throw new Error(
      messages[response.status] || "Request failed. Please try again.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export default function ForgotPasswordModal({ initialEmail = "", onClose }) {
  const [email, setEmail] = useState(initialEmail);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);

  useEffect(() => {
    if (!challenge || done) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge, done]);

  const wait = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now) / 1000))
    : 0;

  const expired = challenge && now >= Date.parse(challenge.expiresAt);

  function close() {
    if (!pending.current) onClose();
  }

  async function submit(action) {
    if (pending.current) return;

    const address = email.trim();

    if (action === "forgot" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError("Enter a valid email address.");
      return;
    }

    if (action === "reset") {
      if (!/^\d{6}$/.test(code)) {
        setError("Enter the six-digit code from your email.");
        return;
      }

      if (
        password.length < 8 ||
        password.length > 72 ||
        password !== confirmation
      ) {
        setError("Use 8–72 password characters and matching passwords.");
        return;
      }

      if (expired) {
        setError("This code has expired. Request a new code.");
        return;
      }
    }

    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (action === "reset") {
        await request("reset", {
          challengeId: challenge.challengeId,
          code,
          newPassword: password,
        });

        setPassword("");
        setConfirmation("");
        setCode("");
        setDone(true);
      } else {
        const result = await request(
          action,
          action === "forgot"
            ? { email: address }
            : { challengeId: challenge.challengeId },
        );

        setChallenge(result);
        setCode("");
        setNow(Date.now());
        setNotice(
          "If this email belongs to an eligible account, a code has been sent. Check your inbox and spam folder.",
        );
      }
    } catch (failure) {
      setError(failure.message || "Check your internet connection.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function field(label, value, change, options = {}) {
    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={change}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          {...options}
        />
      </>
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
            <Text style={styles.title}>
              {done ? "Password updated" : "Reset your password"}
            </Text>

            {done ? (
              <Text style={styles.notice}>
                Your password has changed. Return to sign-in and use your new
                password.
              </Text>
            ) : (
              <>
                <Text style={styles.description}>
                  {challenge
                    ? `Enter the code sent to ${email.trim()} and choose a new password.`
                    : "Enter your ShopMart account email to request a verification code."}
                </Text>

                {!challenge ? (
                  field("Email address", email, setEmail, {
                    keyboardType: "email-address",
                    autoComplete: "email",
                    maxLength: 254,
                  })
                ) : (
                  <>
                    {field(
                      "Verification code",
                      code,
                      (value) => setCode(value.replace(/\D/g, "").slice(0, 6)),
                      {
                        keyboardType: "number-pad",
                        autoComplete: "one-time-code",
                        maxLength: 6,
                      },
                    )}

                    {field("New password", password, setPassword, {
                      secureTextEntry: true,
                      autoComplete: "new-password",
                      maxLength: 72,
                    })}

                    {field(
                      "Confirm new password",
                      confirmation,
                      setConfirmation,
                      {
                        secureTextEntry: true,
                        autoComplete: "new-password",
                        maxLength: 72,
                      },
                    )}
                  </>
                )}

                {notice ? <Text style={styles.notice}>{notice}</Text> : null}

                {expired ? (
                  <Text style={styles.error}>
                    Code expired. Use “Change email / request a new code” below.
                  </Text>
                ) : null}

                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={busy || Boolean(expired)}
                  onPress={() => submit(challenge ? "reset" : "forgot")}
                  style={[styles.primary, (busy || expired) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>
                    {busy
                      ? "Please wait..."
                      : challenge
                        ? "Update password"
                        : "Send verification code"}
                  </Text>
                </Pressable>

                {challenge && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || wait > 0 || Boolean(expired)}
                      onPress={() => submit("resend")}
                      style={styles.linkButton}
                    >
                      <Text style={styles.link}>
                        {expired
                          ? "Code expired"
                          : wait > 0
                            ? `Resend code in ${wait}s`
                            : "Resend code"}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => {
                        setChallenge(null);
                        setCode("");
                        setPassword("");
                        setConfirmation("");
                        setError("");
                        setNotice("");
                      }}
                      style={styles.linkButton}
                    >
                      <Text style={styles.link}>
                        Change email / request a new code
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={close}
              style={styles.linkButton}
            >
              <Text style={styles.link}>Back to sign-in</Text>
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
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
  },
  description: { color: "#64748b", lineHeight: 22, marginBottom: 20 },
  label: { color: "#334155", fontWeight: "700", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    color: "#0f172a",
    fontSize: 15,
    marginBottom: 18,
  },
  primary: {
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    padding: 16,
  },
  primaryText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.5 },
  linkButton: { paddingVertical: 16 },
  link: { color: "#7c3aed", textAlign: "center", fontWeight: "600" },
  error: { color: "#be123c", lineHeight: 22, marginBottom: 14 },
  notice: { color: "#047857", lineHeight: 22, marginBottom: 18 },
});
