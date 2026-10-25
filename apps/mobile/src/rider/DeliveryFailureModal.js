import { useRef, useState } from "react";
import {
  Alert,
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
import * as Crypto from "expo-crypto";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
const reasons = [
  ["CUSTOMER_REFUSED", "Customer refused the parcel"],
  ["CUSTOMER_UNAVAILABLE", "Customer unavailable"],
  ["UNREACHABLE", "Customer could not be contacted"],
  ["INCORRECT_ADDRESS", "Incorrect delivery address"],
  ["DAMAGED_PACKAGE", "Package damaged"],
  ["OTHER", "Other problem"],
];

export default function DeliveryFailureModal({
  session,
  delivery,
  onClose,
  onRecorded,
}) {
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
                <Text style={styles.eyebrow}>DELIVERY SUPPORT</Text>
                <Text style={styles.title}>Report a problem</Text>
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
            <Text style={styles.heading}>What happened?</Text>
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
              {reason === "OTHER"
                ? "Explanation (required)"
                : "Additional note (optional)"}
            </Text>
            <TextInput
              accessibilityLabel="Delivery failure note"
              value={note}
              onChangeText={setNote}
              editable={!busy && !locked}
              multiline
              maxLength={500}
              textAlignVertical="top"
              placeholder="Describe what happened..."
              placeholderTextColor="#a397af"
              style={styles.input}
            />
            <Text style={styles.counter}>{note.length}/500</Text>
            <Text style={styles.muted}>
              This records an unsuccessful attempt. It does not mark the order
              as delivered, collect payment, or automatically cancel it.
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
                    ? "Retry confirmation"
                    : "Submit failure report"}
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
  content: { padding: 22, paddingBottom: 40 },
  grow: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 23,
  },
  eyebrow: {
    color: "#a28cb8",
    fontWeight: "800",
    letterSpacing: 1.5,
    fontSize: 8,
  },
  title: { color: "#342842", fontSize: 24, fontWeight: "800", marginTop: 6 },
  close: { backgroundColor: "#f3edfb", borderRadius: 13, padding: 13 },
  link: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },
  order: {
    padding: 18,
    borderRadius: 19,
    backgroundColor: "#f6f0fc",
    marginBottom: 22,
  },
  orderNumber: { color: "#9985ad", fontSize: 11 },
  customer: { color: "#4f3b62", fontSize: 18, fontWeight: "800", marginTop: 8 },
  muted: { color: "#9a8aa7", fontSize: 12, lineHeight: 21, marginTop: 8 },
  heading: {
    color: "#55425f",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 13,
    marginTop: 10,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 51,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee5f4",
    borderRadius: 13,
    marginBottom: 9,
  },
  selected: { borderColor: "#9b6cde", backgroundColor: "#f5effe" },
  radio: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#d5c7e3",
  },
  activeRadio: {
    borderWidth: 5,
    borderColor: "#8b52d4",
    backgroundColor: "#fff",
  },
  reasonText: { flex: 1, color: "#796587", fontSize: 12, lineHeight: 19 },
  input: {
    minHeight: 105,
    backgroundColor: "#fcfaff",
    borderWidth: 1,
    borderColor: "#e8dcf2",
    borderRadius: 13,
    padding: 14,
    color: "#5c466d",
    fontSize: 13,
  },
  counter: { color: "#b1a3bd", textAlign: "right", fontSize: 10, marginTop: 6 },
  submit: {
    backgroundColor: "#7c3aed",
    padding: 17,
    borderRadius: 14,
    marginTop: 22,
  },
  white: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 13,
  },
  dim: { opacity: 0.5 },
  error: { color: "#be123c", fontSize: 12, lineHeight: 21, marginTop: 15 },
});
