import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
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
import ProductDetailsModal from "./src/products/ProductDetailsModal";
import { useMobileWishlist } from "./src/wishlist/useMobileWishlist";
import Svg, { Path } from "react-native-svg";
import NotificationsModal from "./src/notifications/NotificationsModal";
import ReturnsModal from "./src/returns/ReturnsModal";

const paths = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  bag: "M5 7h14l1 14H4L5 7Zm3 0V6a4 4 0 0 1 8 0v1",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9M7.5 5.5l9 5",
  user: "M20 21v-2a8 8 0 0 0-16 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  cart: "M2 3h3l3 12h11l3-9H6M9 20h.01M18 20h.01",
  close: "m6 6 12 12M6 18 18 6",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
};

function Icon({ name, size = 22, color = "#17203b", filled = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : "none"}
      />
    </Svg>
  );
}

function IconButton({ name, label, onPress, disabled, children }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconButton, disabled && styles.dim]}
    >
      <Icon name={name} />
      {children}
    </Pressable>
  );
}

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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [category, setCategory] = useState("All");
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [returnsOpen, setReturnsOpen] = useState(false);
  const wishlist = useMobileWishlist(auth.session?.user.id, !auth.restoring);

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
  const categories = [
    "All",
    ...new Set((result?.items || []).map((item) => item.category)),
  ];
  const products = (loading ? [] : result.items).filter(
    (product) =>
      (!wishlistOnly || wishlist.hasItem(product.id)) &&
      (category === "All" || product.category === category) &&
      `${product.name} ${product.category}`.toLowerCase().includes(query),
  );

  function openSignedIn(action) {
    if (auth.session) action();
    else setAuthOpen(true);
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.greeting} numberOfLines={1}>
            Hi, {auth.session?.user.name?.split(" ")[0] || "there"}
          </Text>
          <Text style={styles.heroText}>Find your everyday favorites.</Text>
          <Text style={styles.heroCaption}>
            A little something for every day.
          </Text>
        </View>
        <View style={styles.heroArt}>
          <Icon name="bag" size={55} color="#7c3aed" />
          <View style={styles.spark}>
            <Icon name="plus" size={17} color="#a78bfa" />
          </View>
        </View>
      </View>
      <View style={styles.searchBox}>
        <Icon name="search" color="#8b93a7" size={21} />
        <TextInput
          accessibilityLabel="Search products"
          value={search}
          onChangeText={setSearch}
          placeholder="Search products or categories"
          placeholderTextColor="#9299ac"
          autoCorrect={false}
          style={styles.search}
        />
        {search ? (
          <IconButton
            name="close"
            label="Clear search"
            onPress={() => setSearch("")}
          />
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {categories.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: category === name }}
            onPress={() => setCategory(name)}
            style={[styles.chip, category === name && styles.activeChip]}
          >
            <Text style={[styles.chipText, category === name && styles.white]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.section}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>
            {wishlistOnly ? "Your wishlist" : "Discover products"}
          </Text>
          <Text style={styles.sectionCaption}>
            {products.length} products to explore
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => setReload((value) => value + 1)}
          style={styles.refresh}
        >
          <Icon name="refresh" size={17} color="#7c3aed" />
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
      {auth.error || wishlist.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {auth.error || wishlist.error}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>
          Shop<Text style={styles.violet}>Mart</Text>
        </Text>
        <View style={styles.headerActions}>
          <IconButton
            name="bell"
            label="Notifications"
            onPress={() => openSignedIn(() => setNotificationsOpen(true))}
          />
          <IconButton
            name="bag"
            label={`Cart, ${cart.count} items`}
            disabled={cart.loading}
            onPress={() => setCartOpen(true)}
          >
            {cart.count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cart.count > 99 ? "99+" : cart.count}
                </Text>
              </View>
            )}
          </IconButton>
        </View>
      </View>

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color="#7c3aed" size="large" />
            ) : (
              <Icon
                name={wishlistOnly ? "heart" : "search"}
                size={36}
                color="#b7a6df"
              />
            )}
            <Text style={styles.emptyText}>
              {loading
                ? "Loading your everyday finds..."
                : error ||
                  (wishlistOnly
                    ? "Save a few favorites to see them here."
                    : "No matching products. Try another search or category.")}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const quantity = cart.quantityFor(item.id);
          const unavailable = item.stock <= 0;
          const atLimit = quantity >= Math.min(item.stock, 999);
          const saved = wishlist.hasItem(item.id);
          return (
            <View style={styles.card}>
              <View
                style={[
                  styles.art,
                  { backgroundColor: colors[item.color] || colors.lavender },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.name}`}
                  onPress={() => setSelectedProduct(item)}
                  style={StyleSheet.absoluteFill}
                >
                  <View style={styles.photoWrap}>
                    <ProductPhoto
                      key={item.imageUrl || item.id}
                      uri={item.imageUrl}
                      name={item.name}
                    />
                  </View>
                </Pressable>
                <View
                  pointerEvents="none"
                  style={[styles.stock, unavailable && styles.outStock]}
                >
                  <View
                    style={[
                      styles.dot,
                      unavailable && { backgroundColor: "#dc2626" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.stockText,
                      unavailable && { color: "#b91c1c" },
                    ]}
                  >
                    {unavailable ? "Sold out" : "In stock"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${saved ? "Unsave" : "Save"} ${item.name}`}
                  accessibilityState={{ selected: saved }}
                  disabled={wishlist.loading}
                  onPress={() => wishlist.toggleItem(item.id)}
                  style={styles.heart}
                >
                  <Icon
                    name="heart"
                    size={19}
                    color={saved ? "#7c3aed" : "#454d66"}
                    filled={saved}
                  />
                </Pressable>
              </View>
              <View style={styles.cardContent}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedProduct(item)}
                >
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
                <Text style={styles.category} numberOfLines={1}>
                  {item.category}
                </Text>
                <Text
                  style={styles.price}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                >
                  {formatPrice(item.price)}
                </Text>
                {quantity > 0 && !unavailable ? (
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove one ${item.name}`}
                      disabled={cart.loading}
                      style={styles.stepButton}
                      onPress={() =>
                        quantity === 1
                          ? cart.removeItem(item.id)
                          : cart.changeQuantity(item.id, quantity - 1)
                      }
                    >
                      <Icon name="minus" size={19} color="#7c3aed" />
                    </Pressable>
                    <Text style={styles.quantity}>{quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add one ${item.name}`}
                      disabled={cart.loading || atLimit}
                      onPress={() => cart.addItem(item.id)}
                      style={[styles.stepButton, atLimit && styles.dim]}
                    >
                      <Icon name="plus" size={19} color="#7c3aed" />
                    </Pressable>
                  </View>
                ) : (
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
                    <Icon
                      name="cart"
                      color={unavailable ? "#7b8498" : "#fff"}
                      size={17}
                    />
                    <Text
                      style={[
                        styles.addText,
                        unavailable && { color: "#7b8498" },
                      ]}
                    >
                      {unavailable ? "Sold out" : "Add to cart"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={styles.bottomBar}>
        {[
          {
            name: "home",
            label: "Home",
            active: !wishlistOnly,
            action: () => {
              setWishlistOnly(false);
              setCategory("All");
              setSearch("");
            },
          },
          {
            name: "heart",
            label: "Wishlist",
            active: wishlistOnly,
            action: () => {
              setWishlistOnly(true);
              setCategory("All");
              setSearch("");
            },
          },
          {
            name: "box",
            label: "Orders",
            action: () => openSignedIn(() => setOrdersOpen(true)),
          },
          {
            name: "user",
            label: "Account",
            action: () => openSignedIn(() => setAccountOpen(true)),
          },
        ].map((item) => (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityState={{ selected: Boolean(item.active) }}
            accessibilityLabel={item.label}
            onPress={item.action}
            style={styles.bottomItem}
          >
            <Icon
              name={item.name}
              size={23}
              color={item.active ? "#7c3aed" : "#69728b"}
            />
            <Text style={[styles.bottomLabel, item.active && styles.violet]}>
              {item.label}
            </Text>
            <View
              style={[
                styles.indicator,
                !item.active && { backgroundColor: "transparent" },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {selectedProduct && (
        <ProductDetailsModal
          key={selectedProduct.id}
          product={selectedProduct}
          session={auth.session}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      {ordersOpen && auth.session && (
        <OrdersModal
          key={auth.session.user.id}
          session={auth.session}
          onClose={() => setOrdersOpen(false)}
          onOpenReturns={() => {
            setOrdersOpen(false);
            setReturnsOpen(true);
          }}
        />
      )}
      {notificationsOpen && auth.session && (
        <NotificationsModal
          key={auth.session.user.id}
          session={auth.session}
          onClose={() => setNotificationsOpen(false)}
        />
      )}
      {returnsOpen && auth.session && (
        <ReturnsModal
          key={auth.session.user.id}
          session={auth.session}
          onClose={() => setReturnsOpen(false)}
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
          onPlaced={() => setReload((value) => value + 1)}
        />
      )}
      {accountOpen && auth.session && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setAccountOpen(false)}
        >
          <SafeAreaView style={styles.overlay}>
            <View style={styles.accountCard}>
              <View style={styles.accountAvatar}>
                <Icon name="user" size={35} color="#7c3aed" />
              </View>
              <Text style={styles.accountName}>{auth.session.user.name}</Text>
              <Text style={styles.accountEmail}>{auth.session.user.email}</Text>
              {auth.error ? (
                <Text style={styles.error}>{auth.error}</Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={auth.signingOut}
                onPress={() => {
                  setAccountOpen(false);
                  auth.signOut();
                }}
                style={styles.signOut}
              >
                <Icon name="logout" size={19} color="#be123c" />
                <Text style={styles.signOutText}>
                  {auth.signingOut ? "Signing out..." : "Sign out"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAccountOpen(false)}
                style={styles.closeAccount}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>
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
  screen: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -1.3,
    color: "#111a36",
  },
  violet: { color: "#7c3aed" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  badge: {
    position: "absolute",
    right: -1,
    top: 0,
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  list: { paddingHorizontal: 18, paddingBottom: 24 },
  hero: {
    borderRadius: 23,
    backgroundColor: "#f0ebff",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    minHeight: 130,
  },
  heroCopy: { flex: 1, zIndex: 1 },
  greeting: {
    fontSize: 25,
    fontWeight: "800",
    color: "#161c38",
    letterSpacing: -0.7,
  },
  heroText: { marginTop: 8, color: "#69718e", fontSize: 14, lineHeight: 21 },
  heroCaption: { marginTop: 9, fontSize: 10, color: "#9587b8" },
  heroArt: {
    width: 77,
    height: 90,
    borderRadius: 40,
    backgroundColor: "#e7ddff",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-12deg" }],
    marginLeft: 5,
  },
  spark: { position: "absolute", right: -2, top: 2 },
  searchBox: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e3e6ee",
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 5,
    minHeight: 52,
    backgroundColor: "#fdfdff",
  },
  search: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 13,
    color: "#18203b",
  },
  chips: { gap: 9, paddingVertical: 17 },
  chip: {
    borderRadius: 24,
    paddingHorizontal: 21,
    paddingVertical: 12,
    backgroundColor: "#f4f1fc",
  },
  activeChip: { backgroundColor: "#7c3aed" },
  chipText: { color: "#555b76", fontWeight: "600", fontSize: 12 },
  white: { color: "#fff" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#141b35",
    fontWeight: "800",
    fontSize: 21,
    letterSpacing: -0.6,
  },
  sectionCaption: { color: "#9a9fb0", fontSize: 11, marginTop: 4 },
  refresh: { flexDirection: "row", alignItems: "center", padding: 8, gap: 5 },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  row: { justifyContent: "space-between", marginBottom: 15 },
  card: {
    width: "48%",
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7ef",
    backgroundColor: "#fff",
  },
  art: { aspectRatio: 0.92, position: "relative" },
  photoWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  productImage: { width: "100%", height: "100%" },
  productInitial: { fontSize: 52, fontWeight: "800", color: "#b0a0db" },
  stock: {
    position: "absolute",
    top: 9,
    left: 8,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  stockText: { color: "#15803d", fontSize: 8, fontWeight: "700" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#22a65a" },
  outStock: { backgroundColor: "#fff1f2" },
  heart: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffffed",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { padding: 11 },
  productName: {
    color: "#19203c",
    fontSize: 14,
    fontWeight: "800",
    minHeight: 36,
    lineHeight: 18,
  },
  category: { marginTop: 3, color: "#9297aa", fontSize: 11 },
  price: {
    marginTop: 9,
    color: "#7c3aed",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  addButton: {
    minHeight: 44,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  addText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  disabled: { backgroundColor: "#e4e6ee" },
  dim: { opacity: 0.4 },
  stepper: {
    minHeight: 44,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#f4f0ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ede5ff",
  },
  quantity: { fontSize: 16, color: "#202440", fontWeight: "800" },
  empty: { paddingVertical: 45, alignItems: "center", gap: 13 },
  emptyText: {
    color: "#8990a4",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 22,
  },
  error: { color: "#be123c", fontSize: 12, lineHeight: 20, marginBottom: 12 },
  bottomBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f0edf6",
    paddingTop: 8,
    paddingBottom: 3,
    backgroundColor: "#fff",
  },
  bottomItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 5,
    gap: 4,
    minHeight: 58,
  },
  bottomLabel: { fontSize: 10, color: "#7f879b", fontWeight: "600" },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#7c3aed",
  },
  overlay: {
    flex: 1,
    backgroundColor: "#111a3666",
    justifyContent: "center",
    padding: 26,
  },
  accountCard: {
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 25,
    alignItems: "center",
  },
  accountAvatar: { backgroundColor: "#f1ebff", padding: 20, borderRadius: 40 },
  accountName: {
    fontSize: 23,
    fontWeight: "800",
    color: "#19203c",
    marginTop: 17,
    textAlign: "center",
  },
  accountEmail: {
    fontSize: 13,
    color: "#7f879b",
    marginTop: 7,
    marginBottom: 20,
    textAlign: "center",
  },
  signOut: {
    flexDirection: "row",
    gap: 9,
    padding: 15,
    borderRadius: 13,
    backgroundColor: "#fff1f2",
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { color: "#be123c", fontWeight: "700" },
  closeAccount: { padding: 17 },
});
