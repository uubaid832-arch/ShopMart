import { Text, TextInput } from "../i18n/LocalizedNativeComponents.js";
import { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { useMobileAppearance } from "../appearance/MobileAppearance";

let failureTheme = null;

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
const reasons = [
  ["CUSTOMER_REFUSED", "Customer did not accept it"],
  ["CUSTOMER_UNAVAILABLE", "Customer was not home"],
  ["UNREACHABLE", "Customer did not answer"],
  ["INCORRECT_ADDRESS", "Address was wrong or missing"],
  ["DAMAGED_PACKAGE", "Parcel was damaged"],
  ["OTHER", "Other problem"],
];

export default function DeliveryFailureModal({
  session,
  delivery,
  onClose,
  onRecorded,
}) {
  const { theme } = useMobileAppearance();
  failureTheme = theme.colors;
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const snapshot = useRef(null);

  function close() {
    if (pending.current) return;
    if (locked) {
      Alert.alert(
        "Report result uncertain",
        "The report may already be recorded. Retry confirmation here with the same request ID, or close and check the delivery's last attempt before reporting again.",
        [
          { text: "Stay here", style: "cancel" },
          { text: "Close and check", onPress: onClose },
        ],
      );
    } else onClose();
  }

  async function submit() {
    if (pending.current) return;
    if (
      !snapshot.current &&
      (!reason || (reason === "OTHER" && !note.trim()))
    ) {
      setError("Select a reason. Add a note when choosing Other problem.");
      return;
    }
    if (!baseUrl) {
      setError("The mobile API address is missing.");
      return;
    }
    if (!snapshot.current)
      snapshot.current = {
        requestId: Crypto.randomUUID(),
        reason,
        note: note.trim(),
      };
    pending.current = true;
    setBusy(true);
    setLocked(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(
        `${baseUrl}/api/mobile/rider/deliveries/${encodeURIComponent(delivery.id)}/failed`,
        {
          method: "PATCH",
          credentials: "omit",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(snapshot.current),
        },
      );
      if (!response.ok) {
        const messages = {
          400: "Check your reason and note. Notes must not exceed 500 characters.",
          401: "Your session expired. Close this form and sign in again.",
          403: "Rider access is required.",
          404: "This delivery is no longer assigned to you or could not be found.",
          409: "The delivery stage changed. Close this form and refresh before reporting again.",
        };
        if ([400, 401, 403, 404, 409].includes(response.status)) {
          snapshot.current = null;
          setLocked(false);
          throw new Error(messages[response.status]);
        }
        throw new Error(
          "The result could not be confirmed. Use Retry confirmation below to reuse the same request ID.",
        );
      }
      onRecorded();
    } catch (failure) {
      setError(
        snapshot.current
          ? "The report may already be recorded. Tap Retry confirmation to safely confirm the same report."
          : failure.message || "Could not submit the report.",
      );
    } finally {
      clearTimeout(timer);
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
              <View style={styles.grow}>
                <Text style={styles.eyebrow}>DELIVERY HELP</Text>
                <Text style={styles.title}>Could not deliver</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={close}
                style={styles.close}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>
            <View style={styles.order}>
              <Text style={styles.orderNumber}>{delivery.orderNumber}</Text>
              <Text style={styles.customer}>{delivery.customerName}</Text>
              <Text style={styles.muted}>{delivery.address}</Text>
            </View>
            <Text style={styles.heading}>Choose what happened</Text>
            {reasons.map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: reason === value }}
                disabled={busy || locked}
                onPress={() => {
                  setReason(value);
                  setError("");
                }}
                style={[styles.reason, reason === value && styles.selected]}
              >
                <View
                  style={[styles.radio, reason === value && styles.activeRadio]}
                />
                <Text style={styles.reasonText}>{label}</Text>
              </Pressable>
            ))}
            <Text style={styles.heading}>
              {reason === "OTHER" ? "Tell us why" : "Add a note (optional)"}
            </Text>
            <TextInput
              accessibilityLabel="Delivery failure note"
              value={note}
              onChangeText={setNote}
              editable={!busy && !locked}
              multiline
              maxLength={500}
              textAlignVertical="top"
              placeholder="Write a short note..."
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
            <Text style={styles.counter}>{note.length}/500</Text>
            <Text style={styles.muted}>
              This tells the shop you could not deliver the order. It does not
              mark it as delivered or take payment.
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={submit}
              style={[styles.submit, busy && styles.dim]}
            >
              <Text style={styles.white}>
                {busy
                  ? "Submitting..."
                  : locked
                    ? "Check report again"
                    : "Send to the shop"}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f6fb" },
  content: { padding: 16, paddingBottom: 32 },
  grow: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  eyebrow: {
    color: "#514190",
    fontWeight: "900",
    letterSpacing: 1,
    fontSize: 11,
  },
  title: { color: "#182235", fontSize: 25, fontWeight: "900", marginTop: 5 },
  close: { backgroundColor: "#f3edfb", borderRadius: 13, padding: 13 },
  link: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },
  order: {
    padding: 16,
    borderRadius: 17,
    backgroundColor: "#e9e5fb",
    marginBottom: 18,
  },
  orderNumber: { color: "#3f2e91", fontSize: 13, fontWeight: "800" },
  customer: { color: "#182235", fontSize: 19, fontWeight: "900", marginTop: 8 },
  muted: { color: "#344156", fontSize: 14, lineHeight: 22, marginTop: 8 },
  heading: {
    color: "#182235",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 10,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe4ed",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 9,
  },
  selected: { borderColor: "#553bb5", backgroundColor: "#ece9fb" },
  radio: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#5b6474",
  },
  activeRadio: {
    borderWidth: 5,
    borderColor: "#553bb5",
    backgroundColor: "#fff",
  },
  reasonText: { flex: 1, color: "#182235", fontSize: 15, lineHeight: 21, fontWeight: "700" },
  input: {
    minHeight: 105,
    backgroundColor: "#fcfaff",
    borderWidth: 1,
    borderColor: "#cfd5df",
    borderRadius: 13,
    padding: 14,
    color: "#182235",
    fontSize: 13,
  },
  counter: { color: "#475569", textAlign: "right", fontSize: 12, marginTop: 6 },
  submit: {
    minHeight: 56,
    justifyContent: "center",
    backgroundColor: "#4c32a5",
    padding: 16,
    borderRadius: 14,
    marginTop: 18,
  },
  white: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 15,
  },
  dim: { opacity: 0.5 },
  error: { color: "#8a2020", backgroundColor: "#fde9e9", padding: 13, borderRadius: 12, fontSize: 14, lineHeight: 21, marginTop: 15 },
});
const styleColors = {
  screen: c => ({ backgroundColor: c.background }), header: c => ({ backgroundColor: c.background }), eyebrow: c => ({ color: c.accent }), title: c => ({ color: c.text }),
  close: c => ({ backgroundColor: c.soft }), link: c => ({ color: c.accent }), order: c => ({ backgroundColor: c.accentSoft }), orderNumber: c => ({ color: c.accent }),
  customer: c => ({ color: c.text }), muted: c => ({ color: c.muted }), heading: c => ({ color: c.text }), reason: c => ({ backgroundColor: c.surface, borderColor: c.border }),
  selected: c => ({ backgroundColor: c.accentSoft, borderColor: c.accent }), radio: c => ({ borderColor: c.border }),
  activeRadio: c => ({ backgroundColor: c.surface, borderColor: c.accent }), reasonText: c => ({ color: c.text }),
  input: c => ({ backgroundColor: c.surface, borderColor: c.border, color: c.text }), counter: c => ({ color: c.muted }),
  submit: c => ({ backgroundColor: c.accent }), error: c => ({ color: c.danger, backgroundColor: c.dangerSoft }),
};
const styles = new Proxy(baseStyles, { get(target, key) {
  if (typeof key !== "string") return target[key];
  const override = styleColors[key]?.(failureTheme);
  return override ? [target[key], override] : target[key];
}});
