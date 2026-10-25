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
import { placeMobileOrder } from "../api/orders";
import SavedAddresses from "./SavedAddresses";
import { useVoucher } from "../vouchers/useVoucher";
import VoucherField from "../vouchers/VoucherField";
const fields = [
  ["name", "Recipient name", 150],
  ["email", "Email address", 254],
  ["phone", "Phone number — 11 digits", 11],
  ["address", "Delivery address", 500],
  ["city", "City", 150],
];

const formatPrice = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
  }).format(Number(amount));

export default function CheckoutModal({ cart, session, onClose, onPlaced }) {
  const [details, setDetails] = useState({
    name: session?.user.name ?? "",
    email: session?.user.email ?? "",
    phone: /^[0-9]{11}$/.test(session?.user.phone ?? "")
      ? session.user.phone
      : "",
    address: "",
    city: "",
  });

  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const voucher = useVoucher(session, cart.items);
  const pending = useRef(false);
  const snapshot = useRef(null);

  function close() {
    if (pending.current) return;

    if (locked && !confirmation) {
      Alert.alert(
        "Order result uncertain",
        "Closing does not cancel an order that may already exist. Retry here to avoid placing a duplicate.",
        [
          { text: "Stay here", style: "cancel" },
          { text: "Close anyway", onPress: onClose },
        ],
      );
      return;
    }

    onClose();
  }

  function update(name, value) {
    if (locked) return;

    setDetails((current) => ({
      ...current,
      [name]: name === "phone" ? value.replace(/\D/g, "") : value,
    }));
    setError("");
  }

  async function submit() {
    if (pending.current || confirmation || voucher.busy) return;

    if (!session || session.expiresAt <= Date.now()) {
      setError("Please close checkout and sign in again.");
      return;
    }

    if (!snapshot.current && voucher.code.trim() && !voucher.quote) {
      setError("Apply or remove the voucher before placing your order.");
      return;
    }
    if (!snapshot.current) {
      const values = Object.fromEntries(
        Object.entries(details).map(([key, value]) => [key, value.trim()]),
      );

      if (Object.values(values).some((value) => !value)) {
        setError("Please complete all delivery fields.");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
        setError("Enter a valid email address.");
        return;
      }

      if (!/^[0-9]{11}$/.test(values.phone)) {
        setError("The phone number must contain exactly 11 digits.");
        return;
      }

      if (cart.loading || cart.items.length === 0) {
        setError("Your cart is empty or still loading.");
        return;
      }

      snapshot.current = {
        request: {
          ...values,
          idempotencyKey: Crypto.randomUUID(),
          paymentMethod: "COD",
          voucherCode: voucher.quote?.code || null,
          expectedTotal: voucher.quote?.total || null,
          items: cart.items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        },
        items: cart.items.map((item) => ({ ...item })),
        total: voucher.quote?.total ?? cart.total,
        discount: voucher.quote?.discountAmount || "0.00",
        subtotal: voucher.quote?.subtotal ?? cart.total,
      };
    }

    pending.current = true;
    setSaving(true);
    setLocked(true);
    setError("");

    try {
      const order = await placeMobileOrder(
        session.accessToken,
        snapshot.current.request,
      );

      setConfirmation(order);
      cart.clearCart();
    } catch (failure) {
      const rejected = [400, 401, 403, 409].includes(failure.status);

      if (rejected) {
        snapshot.current = null;
        setLocked(false);
      }

      setError(
        rejected
          ? failure.message
          : "The result is uncertain. Tap Retry confirmation here. " +
              "The same request ID will be reused to prevent duplicates.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  function finish() {
    onClose();
    onPlaced?.();
  }

  const summaryItems = snapshot.current?.items ?? cart.items;
  const summaryTotal =
    snapshot.current?.total ?? voucher.quote?.total ?? cart.total;
  const summarySubtotal =
    snapshot.current?.subtotal ?? voucher.quote?.subtotal ?? cart.total;
  const summaryDiscount =
    snapshot.current?.discount ?? voucher.quote?.discountAmount ?? "0.00";

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={confirmation ? finish : close}
    >
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
              <View>
                <Text style={styles.eyebrow}>SHOPMART CHECKOUT</Text>
                <Text style={styles.title}>
                  {confirmation ? "Order placed" : "Delivery details"}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close checkout"
                disabled={saving}
                onPress={confirmation ? finish : close}
                style={styles.close}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            {confirmation ? (
              <>
                <View style={styles.success}>
                  <Text style={styles.successTitle}>
                    Thank you for your order!
                  </Text>
                  <Text style={styles.description}>
                    Your Cash on Delivery order has been placed.
                  </Text>
                </View>

                <Text style={styles.reference}>{confirmation.orderNumber}</Text>

                <Text style={styles.description}>
                  Status: {confirmation.status}
                </Text>
                <Text style={styles.description}>
                  Payment: {confirmation.paymentStatus}
                </Text>

                <View style={styles.summary}>
                  {confirmation.items.map((item) => (
                    <View key={item.productId} style={styles.line}>
                      <Text style={styles.itemName}>
                        {item.name} × {item.quantity}
                      </Text>
                      <Text style={styles.itemPrice}>
                        {formatPrice(
                          Number(item.price) * item.quantity,
                          confirmation.currency,
                        )}
                      </Text>
                    </View>
                  ))}

                  {Number(confirmation.discountAmount) > 0 && (
                    <Text style={styles.description}>
                      Voucher {confirmation.voucherCode}: -
                      {formatPrice(
                        confirmation.discountAmount,
                        confirmation.currency,
                      )}
                    </Text>
                  )}
                  <Text style={styles.total}>
                    {formatPrice(confirmation.total, confirmation.currency)}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={finish}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>Continue shopping</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.description}>
                  Pay cash when your order arrives. Final prices and stock are
                  checked before the order is accepted.
                </Text>
                {session && (
                  <SavedAddresses
                    key={session.user.id}
                    session={session}
                    details={details}
                    disabled={saving || locked}
                    onSelect={(address) => {
                      if (saving || locked) return;
                      setDetails((current) => ({
                        ...current,
                        ...address,
                      }));
                      setError("");
                    }}
                  />
                )}
                {fields.map(([name, label, maxLength]) => (
                  <View key={name} style={styles.field}>
                    <Text style={styles.label}>{label}</Text>
                    <TextInput
                      accessibilityLabel={label}
                      value={details[name]}
                      onChangeText={(value) => update(name, value)}
                      editable={!saving && !locked}
                      maxLength={maxLength}
                      keyboardType={
                        name === "phone"
                          ? "phone-pad"
                          : name === "email"
                            ? "email-address"
                            : "default"
                      }
                      autoCapitalize={name === "email" ? "none" : "words"}
                      autoCorrect={false}
                      multiline={name === "address"}
                      style={styles.input}
                    />
                  </View>
                ))}

                <VoucherField voucher={voucher} disabled={saving || locked} />
                <View style={styles.summary}>
                  <Text style={styles.summaryTitle}>Order summary</Text>

                  {summaryItems.map((item) => (
                    <View key={item.id} style={styles.line}>
                      <Text style={styles.itemName}>
                        {item.name} × {item.quantity}
                      </Text>
                      <Text style={styles.itemPrice}>
                        {formatPrice(item.price * item.quantity)}
                      </Text>
                    </View>
                  ))}

                  <Text style={styles.description}>
                    Product subtotal: {formatPrice(summarySubtotal)}
                  </Text>
                  {Number(summaryDiscount) > 0 && (
                    <Text style={styles.description}>
                      Voucher discount: -{formatPrice(summaryDiscount)}
                    </Text>
                  )}
                  <Text style={styles.description}>Shipping: PKR 0</Text>
                  <Text style={styles.total}>{formatPrice(summaryTotal)}</Text>
                </View>

                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={saving || voucher.busy}
                  onPress={submit}
                  style={[styles.primary, saving && styles.disabled]}
                >
                  <Text style={styles.primaryText}>
                    {saving
                      ? "Placing order…"
                      : locked
                        ? "Retry confirmation"
                        : "Place Cash on Delivery order"}
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
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "800",
    color: "#7c3aed",
  },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a", marginTop: 6 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 28, color: "#64748b" },
  description: { color: "#64748b", fontSize: 12, lineHeight: 20, marginTop: 8 },
  field: { marginTop: 18 },
  label: { fontSize: 13, fontWeight: "700", color: "#334155", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 13,
    padding: 13,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    fontSize: 14,
  },
  summary: {
    backgroundColor: "#f5f3ff",
    borderRadius: 18,
    padding: 16,
    marginVertical: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
    color: "#0f172a",
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 12,
  },
  itemName: { flex: 1, fontSize: 12, color: "#475569" },
  itemPrice: { fontSize: 12, fontWeight: "700", color: "#334155" },
  total: { fontSize: 24, fontWeight: "800", color: "#7c3aed", marginTop: 10 },
  primary: { padding: 16, backgroundColor: "#7c3aed", borderRadius: 14 },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
    fontSize: 13,
  },
  disabled: { opacity: 0.5 },
  error: { color: "#be123c", lineHeight: 21, marginBottom: 16, fontSize: 13 },
  success: { backgroundColor: "#ecfdf5", padding: 20, borderRadius: 18 },
  successTitle: { color: "#047857", fontSize: 20, fontWeight: "800" },
  reference: { color: "#475569", fontSize: 12, marginTop: 20 },
});
