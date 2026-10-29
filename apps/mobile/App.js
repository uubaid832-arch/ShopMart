import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ChatModal from "./src/chatbot/ChatModal";
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
import NotificationBell from "./src/notifications/NotificationBell";
import ReturnsModal from "./src/returns/ReturnsModal";
import ProfileModal from "./src/account/ProfileModal";
import AccountModal from "./src/account/AccountModal";
import ChangePasswordModal from "./src/account/ChangePasswordModal";
import RiderScreen from "./src/rider/RiderScreen";
import { canPreviewStore } from "./src/auth/registrationRules";
import AdminScreen from "./src/admin/AdminScreen";
import BiometricSettingsModal, {
  BiometricLockScreen,
  useBiometricLock,
} from "./src/account/BiometricSecurity";

const paths = {
  grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7",
  laptop: "M4 4h16v12H4V4Zm-2 16h20M9 20h6",
  shirt: "m8 3 4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4 6-5Z",
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
  chat: "M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5Z",
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
      style={({ pressed }) => [
        styles.iconButton,
        disabled && styles.dim,
        pressed && styles.pressed,
      ]}
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
  const [previewAdminId, setPreviewAdminId] = useState(null);
  const isStorePreview = canPreviewStore(auth.session?.user.role, auth.session?.user.id, previewAdminId);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [category, setCategory] = useState("All");
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const wishlist = useMobileWishlist(auth.session?.user.id, !auth.restoring);
  const [biometricOpen, setBiometricOpen] = useState(false);

  const biometric = useBiometricLock(auth.session?.user.id, !auth.restoring);
  const [chatOpen, setChatOpen] = useState(false);

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
  if (biometric.locked) {
    return (
      <BiometricLockScreen
        security={biometric}
        onUsePassword={async () => {
          const signedOut = await biometric.usePassword(auth.clearLocalSession);

          if (signedOut) {
            setAccountOpen(false);
            setProfileOpen(false);
            setPasswordOpen(false);
            setBiometricOpen(false);
            setAuthOpen(true);
          }
        }}
      />
    );
  }
  if (auth.session?.user.role === "ADMIN" && !isStorePreview) {
    return (
      <AdminScreen
        key={auth.session.user.id}
        session={auth.session}
        onPreviewStore={() => setPreviewAdminId(auth.session.user.id)}
        onSignOut={auth.signOut}
        signingOut={auth.signingOut}
        sessionError={auth.error}
        onUpdateUser={auth.updateUser}
        onPasswordChanged={async () => {
          await auth.clearLocalSession();
          setAuthOpen(true);
        }}
        security={biometric}
      />
    );
  }
  if (auth.session?.user.role === "RIDER") {
    return (
      <RiderScreen
        key={auth.session.user.id}
        session={auth.session}
        onSignOut={auth.signOut}
        signingOut={auth.signingOut}
        sessionError={auth.error}
        onUpdateUser={auth.updateUser}
        onPasswordChanged={async () => {
          await auth.clearLocalSession();
          setAuthOpen(true);
        }}
        security={biometric}
      />
    );
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroOrb} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>YOUR EVERYDAY EDIT</Text>
          <Text style={styles.greeting} numberOfLines={1}>
            Hi, {auth.session?.user.name?.split(" ")[0] || "there"}
          </Text>
          <Text style={styles.heroText}>
            Everyday finds. A little more you.
          </Text>
          <Text style={styles.heroCaption}>Explore the things you love.</Text>
        </View>
        <View style={styles.heroArt}>
          <Icon name="bag" size={48} color="#7c3aed" />
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
          placeholder="What are you looking for?"
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
            <Icon
              name={
                name === "All"
                  ? "grid"
                  : /electronic/i.test(name)
                    ? "laptop"
                    : /fashion|cloth/i.test(name)
                      ? "shirt"
                      : /home/i.test(name)
                        ? "home"
                        : "box"
              }
              size={15}
              color={category === name ? "#fff" : "#8d849f"}
            />
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
            {loading
              ? "Finding your favorites..."
              : `${products.length} ${products.length === 1 ? "find" : "finds"} for you`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh products"
          disabled={loading}
          onPress={() => setReload((value) => value + 1)}
          style={styles.refresh}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <Icon name="refresh" size={19} color="#7c3aed" />
          )}
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
      {isStorePreview && <View style={{backgroundColor:"#ede9fe",padding:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}><Text style={{color:"#6d28d9",fontWeight:"700"}}>Store preview · Admin</Text><Pressable accessibilityRole="button" onPress={() => {setPreviewAdminId(null);setCartOpen(false);setAccountOpen(false);}}><Text style={{color:"#6d28d9",fontWeight:"800"}}>Back to Admin →</Text></Pressable></View>}
      <View style={styles.header}>
        <Text style={styles.brand}>
          Shop<Text style={styles.violet}>Mart</Text>
        </Text>
        <View style={styles.headerActions}>
          <IconButton
            name="chat"
            label="Shopping assistant"
            onPress={() => setChatOpen(true)}
          />
          <NotificationBell
            session={auth.session}
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
                  accessibilityLabel={`View ${item.name}`}
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
            style={[styles.bottomItem, item.active && styles.bottomItemActive]}
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
          onOpenReturns={(orderId = null) => {
            setOrdersOpen(false);
            setReturnOrderId(orderId);
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
          key={`${auth.session.user.id}-${returnOrderId ?? "all"}`}
          session={auth.session}
          orderId={returnOrderId}
          onClose={() => { setReturnsOpen(false); setReturnOrderId(null); }}
        />
      )}
      {profileOpen && auth.session && (
        <ProfileModal
          key={auth.session.user.id}
          session={auth.session}
          onSaved={auth.updateUser}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {passwordOpen && auth.session && (
        <ChangePasswordModal
          session={auth.session}
          onClose={() => setPasswordOpen(false)}
          onChanged={async () => {
            await auth.clearLocalSession();
            setPasswordOpen(false);
            setAuthOpen(true);
          }}
        />
      )}
      {biometricOpen && auth.session && (
        <BiometricSettingsModal
          security={biometric}
          onClose={() => setBiometricOpen(false)}
          onLock={() => {
            setBiometricOpen(false);
            biometric.lockNow();
          }}
        />
      )}
      {chatOpen && (
        <ChatModal
          products={result?.items || []}
          onClose={() => setChatOpen(false)}
          onViewProduct={(product) => {
            setChatOpen(false);
            setSelectedProduct(product);
          }}
        />
      )}
      {authOpen && (
        <AuthModal
          onSignIn={auth.signIn}
          onVerify={auth.verifySignIn}
          onClose={() => setAuthOpen(false)}
        />
      )}
      {cartOpen && (
        <CartFlow
          cart={cart}
          previewMode={isStorePreview}
          auth={auth}
          onClose={() => setCartOpen(false)}
          onPlaced={() => setReload((value) => value + 1)}
        />
      )}
      {accountOpen && auth.session && (
        <AccountModal
          session={auth.session}
          busy={auth.signingOut}
          error={auth.error}
          onClose={() => setAccountOpen(false)}
          onEditProfile={() => {
            setAccountOpen(false);
            setProfileOpen(true);
          }}
          onSignOut={() => {
            setPreviewAdminId(null);
            auth.signOut();
          }}
          onChangePassword={() => {
            setAccountOpen(false);
            setPasswordOpen(true);
          }}
          onOpenBiometrics={() => {
            setAccountOpen(false);
            setBiometricOpen(true);
          }}
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
  screen: { flex: 1, backgroundColor: "#fbfafc" },
  header: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fbfafc",
  },
  brand: {
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -1.3,
    color: "#20213a",
  },
  violet: { color: "#7c3aed" },
  headerActions: { flexDirection: "row", gap: 10 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ece9f2",
  },
  pressed: { opacity: 0.6 },
  badge: {
    position: "absolute",
    right: -5,
    top: -5,
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fbfafc",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  list: { paddingHorizontal: 20, paddingBottom: 26 },
  hero: {
    borderRadius: 25,
    backgroundColor: "#efe8fc",
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    minHeight: 162,
    borderWidth: 1,
    borderColor: "#e7ddf9",
  },
  heroOrb: {
    position: "absolute",
    right: -35,
    bottom: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#e7dcfa",
  },
  heroCopy: { flex: 1, zIndex: 1 },
  heroEyebrow: {
    fontSize: 8,
    letterSpacing: 1.8,
    fontWeight: "800",
    color: "#9b85bc",
    marginBottom: 12,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2b2443",
    letterSpacing: -0.9,
  },
  heroText: { marginTop: 8, color: "#786c8e", fontSize: 13, lineHeight: 20 },
  heroCaption: { marginTop: 13, fontSize: 10, color: "#9f8bb9" },
  heroArt: {
    width: 76,
    height: 94,
    borderRadius: 25,
    backgroundColor: "#e0d1f8",
    borderWidth: 1,
    borderColor: "#d8c6f4",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-12deg" }],
    marginLeft: 7,
  },
  spark: {
    position: "absolute",
    right: -7,
    top: -9,
    backgroundColor: "#f8f4ff",
    padding: 5,
    borderRadius: 12,
  },
  searchBox: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8e4ef",
    borderRadius: 17,
    paddingLeft: 16,
    paddingRight: 5,
    minHeight: 54,
    backgroundColor: "#fff",
  },
  search: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 16,
    paddingHorizontal: 11,
    fontSize: 13,
    color: "#343047",
  },
  chips: { gap: 9, paddingTop: 18, paddingBottom: 22 },
  chip: {
    borderRadius: 15,
    paddingHorizontal: 16,
    minHeight: 44,
    backgroundColor: "#f0edf5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#ebe6f2",
  },
  activeChip: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { color: "#787087", fontWeight: "600", fontSize: 11 },
  white: { color: "#fff" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 18,
  },
  sectionTitle: {
    color: "#27253b",
    fontWeight: "800",
    fontSize: 22,
    letterSpacing: -0.7,
  },
  sectionCaption: { color: "#a19aaa", fontSize: 11, marginTop: 5 },
  refresh: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0eafa",
    borderRadius: 14,
  },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  row: { justifyContent: "space-between", marginBottom: 17 },
  card: {
    width: "48%",
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e8e4ee",
    backgroundColor: "#fff",
  },
  art: { aspectRatio: 0.95, position: "relative" },
  photoWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  productImage: { width: "100%", height: "100%" },
  productInitial: { fontSize: 49, fontWeight: "800", color: "#ac9acb" },
  stock: {
    position: "absolute",
    bottom: 9,
    left: 9,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: "#f0fdf4f2",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stockText: { color: "#15803d", fontSize: 8, fontWeight: "700" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#22a65a" },
  outStock: { backgroundColor: "#fff1f2f2" },
  heart: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#fffffff2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ffffffaa",
  },
  cardContent: { padding: 12 },
  productName: {
    color: "#302a41",
    fontSize: 14,
    fontWeight: "700",
    minHeight: 38,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  category: { marginTop: 4, color: "#a29aaf", fontSize: 10 },
  price: {
    marginTop: 12,
    color: "#7c3aed",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  addButton: {
    minHeight: 45,
    marginTop: 13,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  addText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  disabled: { backgroundColor: "#e9e5ee" },
  dim: { opacity: 0.4 },
  stepper: {
    minHeight: 45,
    marginTop: 13,
    borderRadius: 12,
    backgroundColor: "#f2edfb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepButton: {
    width: 44,
    height: 45,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eae1fa",
  },
  quantity: { fontSize: 16, color: "#44315e", fontWeight: "800" },
  empty: { paddingVertical: 45, alignItems: "center", gap: 13 },
  emptyText: {
    color: "#968b9f",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 22,
  },
  error: { color: "#be123c", fontSize: 12, lineHeight: 20, marginBottom: 12 },
  bottomBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#ebe5f2",
    paddingTop: 9,
    paddingHorizontal: 12,
    paddingBottom: 7,
    backgroundColor: "#fff",
    gap: 5,
  },
  bottomItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    gap: 5,
    minHeight: 63,
    borderRadius: 17,
  },
  bottomItemActive: { backgroundColor: "#f3edfc" },
  bottomLabel: { fontSize: 10, color: "#91869e", fontWeight: "600" },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#7c3aed",
  },
});
