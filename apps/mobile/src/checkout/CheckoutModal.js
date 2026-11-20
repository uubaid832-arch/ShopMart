import { Text, TextInput } from "../i18n/LocalizedNativeComponents.js";
import SafepayCheckout from "../payments/SafepayCheckout";
import { sameCart } from "../payments/useSafepay";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { placeMobileOrder } from "../api/orders";
import SavedAddresses from "./SavedAddresses";
import { useVoucher } from "../vouchers/useVoucher";
import VoucherField from "../vouchers/VoucherField";
import BankTransferDetails from "./BankTransferDetails";
import { useMobileAppearance } from "../appearance/MobileAppearance";
import { getMobileStoreSettings } from "../api/storeSettings";
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
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
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
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [safepayOpen, setSafepayOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const successScale = useRef(new Animated.Value(0.4)).current;
  const [bankTransferOpen, setBankTransferOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState(null);
  const [storeSettingsError, setStoreSettingsError] = useState("");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const voucher = useVoucher(session, cart.items);
  const deliveryFee = Number(storeSettings?.deliveryFee ?? 0);
  const freeDeliveryThreshold = Number(storeSettings?.freeDeliveryThreshold ?? 0);
  const productTotalNow = Number(voucher.quote?.total ?? cart.total ?? 0);
  const shippingFeeNow = freeDeliveryThreshold > 0 && productTotalNow >= freeDeliveryThreshold ? 0 : deliveryFee;
  const orderTotalNow = productTotalNow + shippingFeeNow;
  const pending = useRef(false);
  const snapshot = useRef(null);

  useEffect(() => {
    if (!confirmation) return;
    successScale.setValue(0.4);
    Animated.spring(successScale, {
      toValue: 1,
      speed: 15,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [confirmation, successScale]);

  useEffect(() => {
    const controller = new AbortController();
    getMobileStoreSettings(controller.signal)
      .then((settings) => {
        if (controller.signal.aborted) return;
        const operatingCities = (settings.operatingCities || []).filter(Boolean);
        setStoreSettings({ ...settings, operatingCities });
        if (operatingCities.length === 1) setDetails((current) => ({ ...current, city: operatingCities[0] }));
      })
      .catch((failure) => { if (!controller.signal.aborted) setStoreSettingsError(failure.message); });
    return () => controller.abort();
  }, []);

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

      if (!(storeSettings?.operatingCities || []).some((city) => city.toLowerCase() === values.city.toLowerCase())) {
        setError(storeSettingsError || "Choose one of ShopMart's currently supported delivery cities.");
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
          paymentMethod,
          voucherCode: voucher.quote?.code || null,
          expectedTotal: orderTotalNow.toFixed(2),
          items: cart.items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        },
        items: cart.items.map((item) => ({ ...item })),
        total: orderTotalNow,
        shippingFee: shippingFeeNow,
        discount: voucher.quote?.discountAmount || "0.00",
        subtotal: voucher.quote?.subtotal ?? cart.total,
        automaticDiscount: Number(voucher.quote?.automaticDiscountAmount ?? cart.items.reduce((sum, item) => sum + Math.max(0, item.price - (item.effectivePrice ?? item.price)) * item.quantity, 0)),
        voucherDiscount: Number(voucher.quote?.voucherDiscountAmount ?? 0),
      };
    }

    pending.current = true;
    setSaving(true);
    setLocked(true);
    setError("");

    try {
      if (snapshot.current.request.paymentMethod === "DEMO") {
        setSafepayOpen(true);
        return;
      }
      if (snapshot.current.request.paymentMethod === "BANK_TRANSFER") {
        setLocked(false);
        setBankTransferOpen(true);
        return;
      }
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

  async function placeBankTransferOrder() {
    if (pending.current || !snapshot.current) return;
    pending.current = true;
    setSaving(true);
    setLocked(true);
    setError("");
    try {
      const order = await placeMobileOrder(session.accessToken, snapshot.current.request);
      setConfirmation(order);
      setBankTransferOpen(false);
      cart.clearCart();
    } catch (failure) {
      const rejected = [400, 401, 403, 409].includes(failure.status);
      if (rejected) {
        snapshot.current = null;
        setLocked(false);
      }
      setError(rejected
        ? failure.message
        : `The result is uncertain${failure.status ? ` (HTTP ${failure.status})` : ""}. Check My Orders before retrying; this form reuses the same request ID to prevent duplicates.`);
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
    snapshot.current?.total ?? orderTotalNow;
  const summaryShippingFee = snapshot.current?.shippingFee ?? shippingFeeNow;
  const summaryDiscount =
    snapshot.current?.discount ?? voucher.quote?.discountAmount ?? "0.00";
  const originalSubtotal = summaryItems.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const campaignSavings = Number(snapshot.current?.automaticDiscount ?? voucher.quote?.automaticDiscountAmount ?? summaryItems.reduce((sum, item) => sum + Math.max(0, Number(item.price || 0) - Number(item.effectivePrice ?? item.price ?? 0)) * item.quantity, 0));
  const voucherSavings = Number(snapshot.current?.voucherDiscount ?? voucher.quote?.voucherDiscountAmount ?? Math.max(0, Number(summaryDiscount || 0) - campaignSavings));

  if (bankTransferOpen)
    return (
      <BankTransferDetails
        total={summaryTotal}
        name={details.name}
        phone={details.phone}
        settings={storeSettings}
        onBack={() => setBankTransferOpen(false)}
        onClose={() => setBankTransferOpen(false)}
        onPlaceOrder={placeBankTransferOrder}
        busy={saving}
        error={error}
      />
    );

  if (safepayOpen)
    return (
      <SafepayCheckout
        session={session}
        request={snapshot.current.request}
        onPaid={(order) => {
          setConfirmation(order);
          setSafepayOpen(false);
          setLocked(false);
          if (sameCart(cart.items, order.items)) cart.clearCart();
        }}
        onBack={(unresolved) => {
          setSafepayOpen(false);
          setLocked(Boolean(unresolved));
          if (!unresolved) snapshot.current = null;
          setError(
            unresolved
              ? "Resume Safepay checkout to check the saved payment before changing your order."
              : "",
          );
        }}
      />
    );
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={confirmation ? finish : close}
    >
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <KeyboardAvoidingView
          style={[styles.screen, { backgroundColor: palette.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View>
                <Text style={[styles.eyebrow, { color: palette.accent }]}>SHOPMART CHECKOUT</Text>
                <Text style={[styles.title, { color: palette.text }]}>
                  {confirmation ? "Order placed" : "Delivery details"}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close checkout"
                disabled={saving}
                onPress={confirmation ? finish : close}
                style={[styles.close, { backgroundColor: palette.soft }]}
              >
                <Text style={[styles.closeText, { color: palette.muted }]}>×</Text>
              </Pressable>
            </View>

            {confirmation ? (
              <>
                <View style={[styles.success, { backgroundColor: theme.isDark ? "#123b2e" : "#ecfdf5" }]}>
                  <Animated.View style={[styles.successMark, { transform: [{ scale: successScale }] }]}>
                    <Text style={styles.successCheck}>✓</Text>
                  </Animated.View>
                  <Text style={[styles.successTitle, { color: palette.success }]}>
                    Thank you for your order!
                  </Text>
                  <Text style={[styles.description, { color: palette.muted }]}>
                    {confirmation.paymentMethod === "DEMO"
                      ? "Your Safepay sandbox order has been placed. No real money was charged."
                      : confirmation.paymentMethod === "BANK_TRANSFER"
                        ? "Your bank transfer order has been placed and is pending payment receipt review."
                      : "Your Cash on Delivery order has been placed."}
                  </Text>
                </View>

                <Text style={[styles.reference, { color: palette.muted }]}>{confirmation.orderNumber}</Text>

                <Text style={[styles.description, { color: palette.muted }]}>
                  Status: {confirmation.status}
                </Text>
                <Text style={[styles.description, { color: palette.muted }]}>
                  Payment: {confirmation.paymentProvider === "SAFEPAY" && confirmation.paymentStatus === "DEMO_PAID" ? "Paid via Safepay (Sandbox)" : confirmation.paymentStatus}
                </Text>

                <View style={[styles.summary, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  {confirmation.items.map((item) => (
                    <View key={item.productId} style={styles.line}>
                      <Text style={[styles.itemName, { color: palette.text }]}>
                        {item.name} × {item.quantity}
                      </Text>
                      <Text style={[styles.itemPrice, { color: palette.text }]}>
                        {formatPrice(
                          Number(item.price) * item.quantity - Number(item.discountAmount || 0),
                          confirmation.currency,
                        )}
                      </Text>
                    </View>
                  ))}

                  {Number(confirmation.discountAmount) > 0 && (
                    <Text style={[styles.description, { color: palette.muted }]}>
                  {confirmation.voucherCode ? `Discounts · ${confirmation.voucherCode}` : "Product savings"}: -
                      {formatPrice(
                        confirmation.discountAmount,
                        confirmation.currency,
                      )}
                    </Text>
                  )}
                  <Text style={[styles.total, { color: palette.accent }]}>
                    {formatPrice(confirmation.total, confirmation.currency)}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={finish}
                  style={[styles.primary, { backgroundColor: palette.accent }]}
                >
                  <Text style={styles.primaryText}>Continue shopping</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.description, { color: palette.muted }]}>
                  Choose Cash on Delivery or test card checkout with Safepay.
                  Final prices and stock are checked before the order is
                  accepted.
                </Text>
                {session && (
                  <SavedAddresses
                    key={session.user.id}
                    session={session}
                    details={details}
                    disabled={saving || locked}
                    onSelect={(address) => {
                      if (saving || locked) return;
                      const allowed = storeSettings?.operatingCities || [];
                      if (!allowed.some((city) => city.toLowerCase() === address.city.toLowerCase())) {
                        setError(`ShopMart currently delivers only to ${allowed.join(", ") || "its listed cities"}. Choose a supported city and enter the address manually.`);
                        return;
                      }
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
                    <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
                    {name === "city" ? (
                      <View>
                        <Pressable accessibilityRole="button" accessibilityState={{ expanded: cityPickerOpen }} disabled={!storeSettings || saving || locked} onPress={() => setCityPickerOpen((value) => !value)} style={[styles.input, { minHeight: 52, justifyContent: "center", backgroundColor: palette.surface, borderColor: palette.border }]}>
                          <Text style={{ color: details.city ? palette.text : palette.muted }}>{details.city || (storeSettings ? "Choose a delivery city" : "Loading available cities…")} {storeSettings?.operatingCities?.length > 1 ? (cityPickerOpen ? "▴" : "▾") : ""}</Text>
                        </Pressable>
                        {cityPickerOpen && (storeSettings?.operatingCities || []).map((city) => (
                          <Pressable key={city} accessibilityRole="button" onPress={() => { update("city", city); setCityPickerOpen(false); }} style={[styles.input, { marginTop: 6, backgroundColor: details.city === city ? palette.accentSoft : palette.surface, borderColor: palette.border }]}><Text style={{ color: palette.text }}>{details.city === city ? "✓ " : ""}{city}</Text></Pressable>
                        ))}
                        {storeSettingsError ? <Text style={{ color: palette.danger, marginTop: 5 }}>{storeSettingsError}</Text> : storeSettings?.operatingCities?.length ? <Text style={{ color: palette.muted, marginTop: 5 }}>ShopMart currently operates in these cities: {storeSettings.operatingCities.join(", ")}.</Text> : null}
                      </View>
                    ) : <TextInput
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
                      placeholder={label}
                      placeholderTextColor={palette.muted}
                      selectionColor={palette.accent}
                      style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }]}
                    />}
                  </View>
                ))}

                <View style={[styles.summary, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.summaryTitle, { color: palette.text }]}>Payment method</Text>
                  {[
                    { id: "COD", label: "Cash on Delivery" },
                    { id: "DEMO", label: "Card — Safepay" },
                    { id: "BANK_TRANSFER", label: "Bank transfer (demo)" },
                  ].map((method) => (
                    <Pressable
                      key={method.id}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: paymentMethod === method.id,
                      }}
                      disabled={saving || locked}
                      onPress={() => setPaymentMethod(method.id)}
                      style={[styles.line, { paddingVertical: 12 }]}
                    >
                      <Text style={[styles.description, { color: palette.text }]}>
                        {paymentMethod === method.id ? "●" : "○"} {method.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <VoucherField voucher={voucher} disabled={saving || locked} />
                <View style={[styles.summary, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.summaryTitle, { color: palette.text }]}>Order summary</Text>

                  {summaryItems.map((item) => (
                    <View key={item.id} style={styles.line}>
                      <Text style={[styles.itemName, { color: palette.text }]}>
                        {item.name} × {item.quantity}
                      </Text>
                      <Text style={[styles.itemPrice, { color: palette.text }]}>
                        {formatPrice((item.effectivePrice ?? item.price) * item.quantity)}
                      </Text>
                    </View>
                  ))}

                  {(campaignSavings > 0 || voucherSavings > 0) && <Text style={[styles.description, { color: palette.muted }]}>Product subtotal: {formatPrice(originalSubtotal)}</Text>}
                  {campaignSavings > 0 && <Text style={[styles.description, { color: palette.success }]}>Automatic campaign savings: -{formatPrice(campaignSavings)}</Text>}
                  {voucherSavings > 0 && <Text style={[styles.description, { color: palette.success }]}>Voucher savings on full-price products: -{formatPrice(voucherSavings)}</Text>}
                  <Text style={[styles.description, { color: palette.muted }]}>Delivery fee: {summaryShippingFee === 0 ? "Free" : formatPrice(summaryShippingFee)}</Text>
                  <Text style={[styles.total, { color: palette.accent }]}>{formatPrice(summaryTotal)}</Text>
                </View>

                {error ? (
                  <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger }]}>
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={saving || voucher.busy}
                  onPress={submit}
                  style={[styles.primary, { backgroundColor: palette.accent }, saving && styles.disabled]}
                >
                  <Text style={styles.primaryText}>
                    {saving
                      ? "Placing order…"
                      : locked
                        ? "Retry confirmation"
                        : paymentMethod === "DEMO"
                          ? "Pay with Safepay"
                          : paymentMethod === "BANK_TRANSFER"
                            ? "Place bank transfer order"
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
    borderWidth: 1,
    borderColor: "transparent",
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
  successMark: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#059669", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  successCheck: { color: "#fff", fontSize: 34, lineHeight: 38, fontWeight: "900" },
  reference: { color: "#475569", fontSize: 12, marginTop: 20 },
});
