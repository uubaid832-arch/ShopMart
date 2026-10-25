import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
export default function VoucherField({ voucher, disabled }) {
  return (
    <View style={s.card}>
      <Text style={s.title}>Have a voucher?</Text>
      <View style={s.row}>
        <TextInput
          accessibilityLabel="Voucher code"
          placeholder="Enter discount code"
          placeholderTextColor="#a18bad"
          value={voucher.code}
          onChangeText={voucher.change}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={40}
          editable={!disabled && !voucher.busy}
          style={s.input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={disabled || voucher.busy || !voucher.code.trim()}
          onPress={voucher.quote ? voucher.remove : voucher.apply}
          style={[s.button, (disabled || voucher.busy) && s.dim]}
        >
          <Text style={s.white}>
            {voucher.busy ? "Checking..." : voucher.quote ? "Remove" : "Apply"}
          </Text>
        </Pressable>
      </View>
      {voucher.quote && (
        <Text style={s.success}>
          {voucher.quote.code} applied · Save PKR{" "}
          {Number(voucher.quote.discountAmount).toLocaleString("en-PK")}
        </Text>
      )}
      {voucher.error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {voucher.error}
        </Text>
      ) : null}
      <Text style={s.note}>
        One voucher per order. Final eligibility is checked when placing the
        order.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5d9f2",
    borderRadius: 17,
    backgroundColor: "#fcf9ff",
    marginTop: 22,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#58366b",
    marginBottom: 11,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#e0d0ee",
    borderRadius: 11,
    fontSize: 13,
    color: "#56366b",
    backgroundColor: "#fff",
  },
  button: {
    padding: 13,
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
  },
  white: { color: "#fff", fontSize: 11, fontWeight: "700" },
  success: { color: "#258153", fontSize: 12, marginTop: 12 },
  error: { color: "#be3153", fontSize: 12, marginTop: 12 },
  note: { color: "#9a84a9", fontSize: 10, lineHeight: 17, marginTop: 10 },
  dim: { opacity: 0.45 },
});
