import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
  }).format(value);

export default function CartModal({ cart, onClose, onCheckout }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Shopping cart</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close cart"
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        {cart.loading ? (
          <ActivityIndicator
            size="large"
            color="#7c3aed"
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={cart.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>Your cart is waiting.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.muted}>{formatPrice(item.price)} each</Text>

                <View style={styles.row}>
                  <View style={styles.quantity}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease ${item.name} quantity`}
                      disabled={item.quantity <= 1}
                      onPress={() =>
                        cart.changeQuantity(item.id, item.quantity - 1)
                      }
                      style={styles.quantityButton}
                    >
                      <Text style={styles.quantityText}>−</Text>
                    </Pressable>

                    <Text style={styles.quantityValue}>{item.quantity}</Text>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Increase ${item.name} quantity`}
                      disabled={item.quantity >= Math.min(item.stock, 999)}
                      onPress={() =>
                        cart.changeQuantity(item.id, item.quantity + 1)
                      }
                      style={styles.quantityButton}
                    >
                      <Text style={styles.quantityText}>+</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.lineTotal}>
                    {formatPrice(item.price * item.quantity)}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => cart.removeItem(item.id)}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            )}
          />
        )}

        <View style={styles.footer}>
          {!cart.loading && cart.items.length > 0 && (
            <>
              <View style={styles.row}>
                <Text style={styles.name}>Subtotal</Text>
                <Text style={styles.total}>{formatPrice(cart.total)}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={onCheckout}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Proceed to checkout</Text>
              </Pressable>
            </>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.continue}
          >
            <Text style={styles.continueText}>Continue shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 25, fontWeight: "800", color: "#0f172a" },
  close: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 28, color: "#64748b" },
  list: { padding: 20 },
  card: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { color: "#0f172a", fontSize: 15, fontWeight: "700" },
  muted: { color: "#64748b", fontSize: 12, marginTop: 7 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
  },
  quantity: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
  },
  quantityButton: { paddingHorizontal: 13, paddingVertical: 8 },
  quantityText: { fontSize: 20, color: "#7c3aed", fontWeight: "700" },
  quantityValue: { minWidth: 20, textAlign: "center", fontWeight: "700" },
  lineTotal: { color: "#7c3aed", fontWeight: "800", fontSize: 14 },
  remove: { alignSelf: "flex-start", marginTop: 15, paddingVertical: 5 },
  removeText: { color: "#be123c", fontSize: 12, fontWeight: "600" },
  footer: {
    padding: 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  total: { color: "#7c3aed", fontSize: 18, fontWeight: "800" },
  primary: {
    backgroundColor: "#7c3aed",
    padding: 15,
    borderRadius: 14,
    marginTop: 18,
  },
  primaryText: { color: "#fff", textAlign: "center", fontWeight: "800" },
  continue: { paddingTop: 16, alignItems: "center" },
  continueText: { color: "#7c3aed", fontWeight: "600", fontSize: 13 },
  empty: { paddingVertical: 50, textAlign: "center", color: "#64748b" },
});
