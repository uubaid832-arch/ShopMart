import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { getProducts } from "./src/api/products";
import { useMobileSession } from "./src/auth/useMobileSession";
import AuthModal from "./src/auth/AuthModal";
import { useMobileCart } from "./src/cart/useMobileCart";
import CartFlow from "./src/cart/CartFlow";
import OrdersModal from "./src/orders/OrdersModal";
const colors = {
  lavender: "#eeebfc",
  peach: "#fbede5",
  mint: "#e8f3ee",
  sand: "#f8f1df",
};

const formatPrice = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(value);

function ProductPhoto({ uri, name }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return <Text style={styles.productInitial}>{name.charAt(0)}</Text>;
  }

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={name}
      resizeMode="cover"
      style={styles.productImage}
      onError={() => setFailed(true)}
    />
  );
}

function ShopMart() {
  const auth = useMobileSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    getProducts(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setResult({ reload, items, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            reload,
            items: [],
            error: error.message || "Could not connect to ShopMart.",
          });
        }
      });

    return () => controller.abort();
  }, [reload]);

  const cart = useMobileCart(
    result && !result.error ? result.items : null,
    auth.session?.user.id,
    !auth.restoring,
  );

  const loading = result?.reload !== reload;
  const error = loading ? "" : result.error;
  const query = search.trim().toLowerCase();

  const products = (loading ? [] : result.items).filter((product) =>
    `${product.name} ${product.category}`.toLowerCase().includes(query),
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.brand}>
          Shop<Text style={styles.violet}>Mart</Text>
        </Text>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cart, ${cart.count} items`}
            disabled={cart.loading}
            onPress={() => setCartOpen(true)}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>
              Cart {cart.loading ? "..." : `(${cart.count})`}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={auth.restoring || auth.signingOut}
            onPress={() => {
              if (auth.session) auth.signOut();
              else setAuthOpen(true);
            }}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>
              {auth.restoring
                ? "Loading..."
                : auth.signingOut
                  ? "Signing out..."
                  : auth.session
                    ? "Sign out"
                    : "Sign in"}
            </Text>
          </Pressable>
        </View>
      </View>
      {auth.session && (
        <View
          style={[
            styles.accountStrip,
            {
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            },
          ]}
        >
          <Text style={[styles.accountName, { flex: 1 }]}>
            Welcome, {auth.session.user.name}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => setOrdersOpen(true)}
          >
            <Text style={styles.headerButtonText}>My orders →</Text>
          </Pressable>
        </View>
      )}

      {ordersOpen && auth.session && (
        <OrdersModal
          key={auth.session.user.id}
          session={auth.session}
          onClose={() => setOrdersOpen(false)}
        />
      )}
      {auth.error ? (
        <Text accessibilityRole="alert" style={styles.authError}>
          {auth.error}
        </Text>
      ) : null}

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>YOUR EVERYDAY FINDS</Text>
        <Text style={styles.title}>Find something you love.</Text>

        <TextInput
          accessibilityLabel="Search products"
          placeholder="Search products or categories"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          style={styles.search}
        />

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => setReload((current) => current + 1)}
          style={styles.refresh}
        >
          <Text style={styles.headerButtonText}>Refresh products</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.subtitle}>Loading products...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={
            <Text style={styles.empty}>No matching products.</Text>
          }
          renderItem={({ item }) => {
            const quantity = cart.quantityFor(item.id);
            const unavailable = item.stock <= 0;
            const atLimit = quantity >= Math.min(item.stock, 999);

            return (
              <View style={styles.card}>
                <View
                  style={[
                    styles.art,
                    {
                      backgroundColor: colors[item.color] ?? colors.lavender,
                    },
                  ]}
                >
                  <ProductPhoto
                    key={item.imageUrl || item.id}
                    uri={item.imageUrl}
                    name={item.name}
                  />
                  <Text style={styles.stock}>
                    {unavailable ? "Out of stock" : "In stock"}
                  </Text>
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.category}>{item.category}</Text>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.price}>{formatPrice(item.price)}</Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name} to cart`}
                    disabled={cart.loading || unavailable || atLimit}
                    onPress={() => cart.addItem(item.id)}
                    style={[
                      styles.addButton,
                      (cart.loading || unavailable || atLimit) &&
                        styles.disabled,
                    ]}
                  >
                    <Text style={styles.addText}>
                      {unavailable
                        ? "Out of stock"
                        : atLimit
                          ? "Limit reached"
                          : "+ Add to cart"}
                    </Text>
                  </Pressable>

                  {quantity > 0 && (
                    <Text style={styles.quantity}>{quantity} in your cart</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {authOpen && (
        <AuthModal onSignIn={auth.signIn} onClose={() => setAuthOpen(false)} />
      )}

      {cartOpen && (
        <CartFlow
          cart={cart}
          auth={auth}
          onClose={() => setCartOpen(false)}
          onPlaced={() => setReload((current) => current + 1)}
        />
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ShopMart />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  brand: { fontSize: 23, fontWeight: "900", color: "#0f172a" },
  violet: { color: "#7c3aed" },
  headerActions: { flexDirection: "row", gap: 6 },
  headerButton: { backgroundColor: "#f5f3ff", borderRadius: 11, padding: 10 },
  headerButtonText: { color: "#7c3aed", fontWeight: "700", fontSize: 11 },
  accountStrip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#f5f3ff",
  },
  accountName: { color: "#6d28d9", fontSize: 13, fontWeight: "600" },
  authError: { margin: 16, color: "#be123c", fontSize: 13 },
  intro: { padding: 20 },
  eyebrow: {
    color: "#7c3aed",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: { marginTop: 9, fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { marginTop: 8, color: "#64748b", fontSize: 13 },
  search: {
    marginTop: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    color: "#0f172a",
    fontSize: 14,
  },
  refresh: { alignSelf: "flex-end", paddingTop: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  row: { justifyContent: "space-between", marginBottom: 14 },
  card: {
    width: "48%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  art: { height: 110, alignItems: "center", justifyContent: "center" },
  productImage: { width: "100%", height: "100%" },
  productInitial: { fontSize: 44, fontWeight: "900", color: "#51478a" },
  stock: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
  },
  cardContent: { padding: 12 },
  category: { fontSize: 10, color: "#64748b" },
  productName: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  price: { marginTop: 10, fontSize: 14, fontWeight: "800", color: "#7c3aed" },
  quantity: { marginTop: 7, fontSize: 10, color: "#64748b" },
  addButton: {
    marginTop: 12,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingVertical: 10,
  },
  addText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  disabled: { backgroundColor: "#94a3b8" },
  center: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: "#be123c", fontSize: 14, textAlign: "center" },
  empty: { paddingVertical: 30, textAlign: "center", color: "#64748b" },
});