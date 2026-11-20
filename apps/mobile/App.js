import { Text, TextInput } from "./src/i18n/LocalizedNativeComponents.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ActivityIndicator, Animated, FlatList, Image, Modal, ScrollView, Pressable, StyleSheet, View } from "react-native";
import ChatModal from "./src/chatbot/ChatModal";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { getProducts } from "./src/api/products";
import { getMobileStoreSettings } from "./src/api/storeSettings";
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
import AppearanceModal from "./src/appearance/AppearanceModal";
import { MobileAppearanceProvider, useMobileAppearance } from "./src/appearance/MobileAppearance";
import { MobileLanguageProvider, useMobileLanguage } from "./src/i18n/MobileLanguage";

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
  check: "m5 12 4 4L19 6",
  arrow: "m9 5 7 7-7 7",
  back: "m15 5-7 7 7 7",
  logout: "M9 3H4v18h5m6-15 6 6-6 6M9 12h12",
  chat: "M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5Z",
  palette: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a1.5 1.5 0 0 1 0-3h3a6 6 0 0 0 6-6c0-2.8-4-5-9-5ZM7.5 10h.01M10 6.5h.01M15 6.5h.01M17.5 10h.01",
};

const CUSTOMER_PRODUCTS_PER_PAGE = 10;
const CUSTOMER_HOME_PRODUCT_LIMIT = 6;

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

function IconButton({ name, label, onPress, disabled, children, color, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconButton,
        style,
        disabled && styles.dim,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={name} color={color || "#17203b"} />
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
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const languageSettings = useMobileLanguage();
  const auth = useMobileSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [previewAdminId, setPreviewAdminId] = useState(null);
  const isStorePreview = canPreviewStore(auth.session?.user.role, auth.session?.user.id, previewAdminId);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [catalogFiltersOpen, setCatalogFiltersOpen] = useState(true);
  const [saleFirst, setSaleFirst] = useState(false);
  const [productPage, setProductPage] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const productsListRef = useRef(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [category, setCategory] = useState("All");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [returnsOpen, setReturnsOpen] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const wishlist = useMobileWishlist(auth.session?.user.id, !auth.restoring);
  const [biometricOpen, setBiometricOpen] = useState(false);
  const cartPulse = useRef(new Animated.Value(1)).current;
  const heartPulse = useRef(new Animated.Value(1)).current;
  const [cartPulseId, setCartPulseId] = useState(null);
  const [heartPulseId, setHeartPulseId] = useState(null);
  const [cartToast, setCartToast] = useState("");
  const cartToastOpacity = useRef(new Animated.Value(0)).current;
  const cartToastScale = useRef(new Animated.Value(0.86)).current;

  const biometric = useBiometricLock(auth.session?.user.id, !auth.restoring);
  const [chatOpen, setChatOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [announcementMessages, setAnnouncementMessages] = useState([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const announcementMotion = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const controller = new AbortController();
    getMobileStoreSettings(controller.signal)
      .then((settings) => { if (!controller.signal.aborted) setAnnouncementMessages((settings.announcementMessages || []).filter((value) => String(value || "").trim())); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (announcementMessages.length < 2) return undefined;
    const timer = setInterval(() => setAnnouncementIndex((index) => (index + 1) % announcementMessages.length), 5000);
    return () => clearInterval(timer);
  }, [announcementMessages.length]);

  useEffect(() => {
    announcementMotion.setValue(0);
    Animated.timing(announcementMotion, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [announcementIndex, announcementMotion]);

  const updateRatingSummary = useCallback((productId, summary) => {
    setResult((current) => {
      if (!current?.items) return current;
      let changed = false;
      const items = current.items.map((item) => {
        if (item.id !== productId) return item;
        const averageRating = Number(summary.averageRating) || 0;
        const reviewCount = Number(summary.reviewCount) || 0;
        if (
          Number(item.averageRating) === averageRating &&
          Number(item.reviewCount) === reviewCount
        ) return item;
        changed = true;
        return { ...item, averageRating, reviewCount };
      });
      return changed ? { ...current, items } : current;
    });
  }, []);

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
  const query = search.trim().normalize("NFKC").toLocaleLowerCase();
  const searchWords = [...new Set(query.split(/\s+/).filter(Boolean))];
  const categories = [
    "All",
    ...[...new Set((result?.items || []).map((item) => item.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
  ];
  const quickCategories = categories.slice(0, 8);
  if (category !== "All" && categories.includes(category) && !quickCategories.includes(category)) {
    quickCategories[quickCategories.length - 1] = category;
  }
  const matchingCategories = categories.filter((name) =>
    name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase()),
  );
  const products = (loading ? [] : result.items)
    .map((product, index) => {
      const name = String(product.name || "").normalize("NFKC").toLocaleLowerCase();
      const categoryName = String(product.category || "").normalize("NFKC").toLocaleLowerCase();
      const description = String(product.description || "").normalize("NFKC").toLocaleLowerCase();
      const searchable = `${name} ${categoryName} ${description}`;
      const score = query
        ? (name === query ? 1000 : name.startsWith(query) ? 800 : name.includes(query) ? 600 : 0) +
          searchWords.reduce((total, word) => total + (name.includes(word) ? 100 : categoryName.includes(word) ? 30 : description.includes(word) ? 10 : 0), 0)
        : 0;
      return {
        product,
        index,
        score,
        matches:
          searchWords.every((word) => searchable.includes(word)) &&
          (!wishlistOnly || wishlist.hasItem(product.id)) &&
          (category === "All" || product.category === category) &&
          (!selectedCampaign || product.discountCampaignId === selectedCampaign.id),
      };
    })
    .filter((entry) => entry.matches)
    .sort((a, b) => {
      if (query && a.score !== b.score) return b.score - a.score;
      if (saleFirst) {
        const aSale = a.product.discountedPrice != null && Number(a.product.discountedPrice) < Number(a.product.price);
        const bSale = b.product.discountedPrice != null && Number(b.product.discountedPrice) < Number(b.product.price);
        if (aSale !== bSale) return Number(bSale) - Number(aSale);
      }
      return a.index - b.index;
    })
    .map(({ product }) => product);
  const namedPromotions = [...new Map((loading ? [] : result.items)
    .filter((product) => product.discountedPrice != null && product.discountCampaignId && product.discountCampaignName)
    .map((product) => [product.discountCampaignId, {
      id: product.discountCampaignId,
      name: product.discountCampaignName,
      productCount: 0,
    }]))].map(([id, promotion]) => ({
      ...promotion,
      productCount: result.items.filter((product) => product.discountCampaignId === id && product.discountedPrice != null).length,
    }));
  const productPageCount = Math.max(
    1,
    Math.ceil(products.length / CUSTOMER_PRODUCTS_PER_PAGE),
  );
  const currentProductPage = Math.min(productPage, productPageCount - 1);
  const catalogPageProducts = products.slice(
    currentProductPage * CUSTOMER_PRODUCTS_PER_PAGE,
    (currentProductPage + 1) * CUSTOMER_PRODUCTS_PER_PAGE,
  );
  const visibleProducts = catalogOpen
    ? catalogPageProducts
    : products.slice(0, CUSTOMER_HOME_PRODUCT_LIMIT);

  function changeProductPage(nextPage) {
    setProductPage(nextPage);
    requestAnimationFrame(() => productsListRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }

  function resetProductPage() {
    setProductPage(0);
    requestAnimationFrame(() => productsListRef.current?.scrollToOffset({ offset: 0, animated: false }));
  }

  function openCatalog() {
    setCatalogOpen(true);
    resetProductPage();
  }

  function closeCatalog() {
    setCatalogOpen(false);
    setSelectedCampaign(null);
    resetProductPage();
  }

  function openCampaign(campaign) {
    setSelectedProduct(null);
    setSelectedCampaign(campaign);
    setCatalogOpen(true);
    setWishlistOnly(false);
    setCategory("All");
    setSearch("");
    resetProductPage();
  }

  function clearCampaign() {
    setSelectedCampaign(null);
    resetProductPage();
  }

  function pop(value) {
    value.setValue(0.72);
    Animated.sequence([
      Animated.spring(value, { toValue: 1.24, speed: 26, bounciness: 9, useNativeDriver: true }),
      Animated.spring(value, { toValue: 1, speed: 22, bounciness: 7, useNativeDriver: true }),
    ]).start();
  }

  function addProduct(productId) {
    const product = products.find((item) => item.id === productId);
    cart.addItem(productId);
    setCartPulseId(productId);
    pop(cartPulse);
    if (product) {
      setCartToast(product.name);
      cartToastOpacity.setValue(0);
      cartToastScale.setValue(0.86);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(cartToastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.spring(cartToastScale, { toValue: 1, speed: 22, bounciness: 8, useNativeDriver: true }),
        ]),
        Animated.delay(1500),
        Animated.timing(cartToastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setCartToast("");
      });
    }
  }

  function toggleProductWishlist(productId, wasSaved) {
    wishlist.toggleItem(productId);
    if (!wasSaved) {
      setHeartPulseId(productId);
      pop(heartPulse);
    }
  }

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

  const searchBar = (
    <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Icon name="search" color={palette.muted} size={21} />
      <TextInput
        accessibilityLabel="Search products"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setCatalogFiltersOpen(!value.trim());
          resetProductPage();
        }}
        placeholder="Search products, brands, categories"
        placeholderTextColor={palette.muted}
        autoCorrect={false}
        style={[styles.search, { color: palette.text }]}
      />
      {search ? (
        <IconButton
          name="close"
          label="Clear search"
          onPress={() => {
            setSearch("");
            setCatalogFiltersOpen(true);
            resetProductPage();
          }}
        />
      ) : null}
    </View>
  );

  const categorySlider = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {quickCategories.map((name) => (
        <Pressable
          key={name}
          accessibilityRole="button"
          accessibilityState={{ selected: category === name }}
          onPress={() => {
            setCategory(name);
            resetProductPage();
          }}
          style={[
            styles.chip,
            { backgroundColor: palette.soft, borderColor: palette.border },
            category === name && { backgroundColor: palette.accent, borderColor: palette.accent },
          ]}
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
            color={category === name ? "#fff" : palette.muted}
          />
          <Text style={[styles.chipText, category === name && styles.white]}>
            {name}
          </Text>
        </Pressable>
      ))}
      {categories.length > quickCategories.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all categories"
          onPress={() => {
            setCategorySearch("");
            setCategoryPickerOpen(true);
          }}
          style={[styles.chip, styles.viewAllCategoryChip, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}
        >
          <Icon name="grid" size={15} color={palette.accent} />
          <Text style={[styles.chipText, { color: palette.accent }]}>View all</Text>
          <Icon name="arrow" size={13} color={palette.accent} />
        </Pressable>
      ) : null}
    </ScrollView>
  );

  const announcementTicker = announcementMessages.length > 0 ? (
    <View style={{ minHeight: 42, marginHorizontal: 14, marginTop: 8, marginBottom: 2, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: theme.isDark ? "#090e1b" : "#172033", borderWidth: 1, borderColor: palette.border }} accessibilityLabel="ShopMart announcements">
      <Pressable accessibilityRole="button" accessibilityLabel="Previous announcement" onPress={() => setAnnouncementIndex((index) => (index - 1 + announcementMessages.length) % announcementMessages.length)} style={{ width: 30, height: 34, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>‹</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => catalogOpen ? productsListRef.current?.scrollToOffset({ offset: 0, animated: true }) : openCatalog()} style={{ flex: 1, overflow: "hidden", paddingVertical: 8 }}>
        <Animated.View style={{ opacity: announcementMotion, transform: [{ translateX: announcementMotion.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>
          <Text numberOfLines={1} style={{ color: "#fff", textAlign: "center", fontSize: 12, fontWeight: "700" }}>{announcementMessages[announcementIndex % announcementMessages.length]}</Text>
        </Animated.View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Next announcement" onPress={() => setAnnouncementIndex((index) => (index + 1) % announcementMessages.length)} style={{ width: 30, height: 34, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>›</Text></Pressable>
    </View>
  ) : null;

  const homeHeader = (
    <View style={styles.homeHeader}>
      {!search.trim() && !wishlistOnly ? (
        <View
          style={[
            styles.homeHero,
            { backgroundColor: theme.isDark ? palette.elevated : "#eaf2ff", borderColor: palette.border },
          ]}
        >
          <View style={styles.homeHeroText}>
            <Text style={[styles.heroEyebrow, { color: palette.accent }]}>SHOPMART PICKS</Text>
            <Text style={[styles.homeHeroTitle, { color: palette.text }]}>Find something you'll love.</Text>
            <Text style={[styles.homeHeroCaption, { color: palette.muted }]}>Fresh finds for your everyday.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Discover all products"
              onPress={openCatalog}
              style={[styles.homeHeroButton, { backgroundColor: palette.accent }]}
            >
              <Text style={styles.homeHeroButtonText}>Explore ShopMart</Text>
              <Icon name="arrow" size={17} color="#fff" />
            </Pressable>
          </View>
          <View style={[styles.homeHeroArt, { backgroundColor: palette.accentSoft }]}>
            <Icon name="bag" size={42} color={palette.accent} />
            <View style={[styles.homeHeroSpark, { backgroundColor: palette.surface }]}>
              <Icon name="plus" size={15} color={palette.accent} />
            </View>
          </View>
        </View>
      ) : null}

      {searchBar}

      <View style={styles.homeCategoryHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Shop by category</Text>
          <Text style={[styles.sectionCaption, { color: palette.muted }]}>Pick a section to narrow your finds</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh products"
          disabled={loading}
          onPress={() => setReload((value) => value + 1)}
          style={[styles.refresh, { backgroundColor: palette.accentSoft }]}
        >
          {loading ? <ActivityIndicator size="small" color={palette.accent} /> : <Icon name="refresh" size={19} color={palette.accent} />}
        </Pressable>
      </View>
      {!search.trim() ? categorySlider : null}

      {!loading && !search.trim() && !wishlistOnly && !selectedCampaign && namedPromotions.length > 0 ? (
        <View style={{ marginTop: 18 }}>
          <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 10 }]}>Current promotions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
            {namedPromotions.map((promotion, index) => (
              <Pressable
                key={promotion.id}
                accessibilityRole="button"
                accessibilityLabel={`Shop ${promotion.name} promotion with ${promotion.productCount} products`}
                onPress={() => openCampaign(promotion)}
                style={({ pressed }) => ({ width: 280, minHeight: 132, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: index % 2 ? "#d8c5f6" : "#f3c66d", backgroundColor: index % 2 ? (theme.isDark ? "#29213c" : "#f4edff") : (theme.isDark ? "#3b2a16" : "#fff4dc"), opacity: pressed ? 0.86 : 1 })}
              >
                <Text style={{ color: index % 2 ? palette.accent : (theme.isDark ? "#ffd276" : "#a14b0b"), fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>SHOPMART PROMOTION</Text>
                <Text numberOfLines={2} style={{ color: palette.text, fontSize: 19, fontWeight: "900", marginTop: 7 }}>{promotion.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <Text style={{ color: palette.muted, fontSize: 12 }}>{promotion.productCount} sale {promotion.productCount === 1 ? "product" : "products"}</Text>
                  <Text style={{ color: index % 2 ? palette.accent : "#a14b0b", fontWeight: "900" }}>Shop now ›</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.homeProductsHeading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
              {wishlistOnly ? "Your wishlist" : search.trim() ? "Best matches" : selectedCampaign?.name || (selectedCampaign ? "Sale products" : "Picked for you")}
          </Text>
          <Text style={[styles.sectionCaption, { color: palette.muted }]}>
            {loading ? "Finding your favorites..." : `${products.length} ${products.length === 1 ? "product" : "products"}${wishlistOnly ? " saved" : " to explore"}`}
          </Text>
        </View>
        {wishlistOnly && products.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear wishlist"
            disabled={wishlist.loading}
            onPress={() => Alert.alert(
              "Clear wishlist?",
              "Remove every saved product from your wishlist?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Clear wishlist", style: "destructive", onPress: wishlist.clearAll },
              ],
            )}
            style={[styles.clearWishlistButton, { backgroundColor: theme.isDark ? "#442330" : "#fff0f3" }, wishlist.loading && styles.dim]}
          >
            <Text style={[styles.clearWishlistText, { color: palette.danger }]}>Clear wishlist</Text>
          </Pressable>
        ) : null}
      </View>
      {auth.error || wishlist.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {auth.error || wishlist.error}
        </Text>
      ) : null}
    </View>
  );

  const catalogHeader = (
    <View style={styles.catalogHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        onPress={closeCatalog}
        style={[styles.backHomeButton, { backgroundColor: palette.accentSoft }]}
      >
        <Icon name="back" size={19} color={palette.accent} />
        <Text style={[styles.backHomeText, { color: palette.accent }]}>Back to home</Text>
      </Pressable>
      <View style={styles.catalogTitleBlock}>
        <Text style={[styles.heroEyebrow, { color: palette.accent }]}>THE FULL COLLECTION</Text>
        <Text style={[styles.catalogTitle, { color: palette.text }]}>
          {wishlistOnly ? "Wishlist" : selectedCampaign ? (selectedCampaign.name || "Sale products") : "Discover more"}
        </Text>
        <Text style={[styles.sectionCaption, { color: palette.muted }]}>
          {loading ? "Loading products..." : `${products.length} ${products.length === 1 ? "product" : "products"} available`}
        </Text>
      </View>
      {selectedCampaign ? (
        <View style={{ marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: theme.isDark ? "#3b2a16" : "#fff4dc", borderWidth: 1, borderColor: "#f3c66d" }}>
          <Text style={{ color: "#b45309", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>SHOP THE PROMOTION</Text>
          <Text style={{ color: theme.isDark ? "#fff0c2" : "#713f12", fontSize: 20, lineHeight: 26, fontWeight: "900", marginTop: 5 }}>{selectedCampaign.name || "Sale promotion"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: theme.isDark ? "#e9d8b3" : "#785b35", flex: 1 }}>{products.length} promotional {products.length === 1 ? "product" : "products"}</Text>
            <Pressable accessibilityRole="button" onPress={clearCampaign} style={{ backgroundColor: theme.isDark ? "#583d1a" : "#fff", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 }}>
              <Text style={{ color: "#9a4c08", fontWeight: "800" }}>View all products</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {searchBar}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: catalogFiltersOpen }} onPress={() => setCatalogFiltersOpen((open) => !open)} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }}>
          <Text style={{ color: palette.text, fontWeight: "700" }}>{catalogFiltersOpen ? "Hide filters" : "Filters & sort"}</Text>
        </Pressable>
      </View>
      {catalogFiltersOpen ? <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
          <Text style={{ color: palette.muted, fontWeight: "700" }}>Sort by</Text>
          {[{ label: "Recommended", value: false }, { label: "On sale first", value: true }].map((option) => (
            <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected: saleFirst === option.value }} onPress={() => { setSaleFirst(option.value); resetProductPage(); }} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: saleFirst === option.value ? palette.accent : palette.surface, borderWidth: 1, borderColor: saleFirst === option.value ? palette.accent : palette.border }}>
              <Text style={{ color: saleFirst === option.value ? "#fff" : palette.text, fontWeight: "800" }}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.categoryLabel, { color: palette.text }]}>Browse categories</Text>
        {categorySlider}
      </> : null}
      <View style={styles.catalogListHeading}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {search.trim() ? "Search results" : selectedCampaign?.name || (category === "All" ? "All products" : category)}
        </Text>
        <Text style={[styles.sectionCaption, { color: palette.muted }]}>Page {currentProductPage + 1} of {productPageCount}</Text>
      </View>
    </View>
  );

  const header = catalogOpen ? catalogHeader : homeHeader;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      {isStorePreview && <View style={{backgroundColor:"#ede9fe",padding:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}><Text style={{color:"#6d28d9",fontWeight:"700"}}>Store preview · Admin</Text><Pressable accessibilityRole="button" onPress={() => {setPreviewAdminId(null);setCartOpen(false);setAccountOpen(false);}}><Text style={{color:"#6d28d9",fontWeight:"800"}}>Back to Admin →</Text></Pressable></View>}
      <View style={[styles.header, { backgroundColor: palette.background }]}>
          <Text style={[styles.brand, { color: palette.text }]}>
          Shop<Text style={[styles.violet, { color: palette.accent }]}>Mart</Text>
        </Text>
        <View style={styles.headerActions}>
          <NotificationBell
            session={auth.session}
            onPress={() => openSignedIn(() => setNotificationsOpen(true))}
            accentColor={palette.accent}
            surfaceColor={palette.surface}
            borderColor={palette.border}
          />
          <IconButton
            name="bag"
            label={`Cart, ${cart.count} items`}
            disabled={cart.loading}
            color={palette.text}
            style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            onPress={() => setCartOpen(true)}
          >
            {cart.count > 0 && (
              <Animated.View style={[styles.badge, { backgroundColor: "#dc2626", transform: [{ scale: cartPulse }] }]}>
                <Text style={styles.badgeText}>
                  {cart.count > 99 ? "99+" : cart.count}
                </Text>
              </Animated.View>
            )}
          </IconButton>
        </View>
      </View>

      {announcementTicker}

      {cartToast ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[styles.cartToast, { opacity: cartToastOpacity, transform: [{ scale: cartToastScale }] }]}
        >
          <Icon name="cart" size={20} color="#047857" />
          <Text style={styles.cartToastText} numberOfLines={1}>{cartToast} added to cart ✓</Text>
          <Pressable accessibilityRole="button" onPress={() => setCartOpen(true)}>
            <Text style={styles.cartToastLink}>View cart</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <FlatList
        ref={productsListRef}
        data={visibleProducts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={header}
        ListFooterComponent={
          catalogOpen ? (
            productPageCount > 1 ? (
              <View
                style={[
                  styles.catalogPagination,
                  { backgroundColor: palette.surface, borderTopColor: palette.border },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous product page"
                  disabled={currentProductPage === 0}
                  onPress={() => changeProductPage(currentProductPage - 1)}
                  style={[
                    styles.catalogPageButton,
                    { backgroundColor: palette.accentSoft },
                    currentProductPage === 0 && styles.dim,
                  ]}
                >
                  <Text
                    style={[
                      styles.catalogPageButtonText,
                      { color: currentProductPage === 0 ? palette.muted : palette.accent },
                    ]}
                  >
                    Previous
                  </Text>
                </Pressable>
                <Text style={[styles.catalogPageNumber, { color: palette.text }]}>
                  {currentProductPage + 1} / {productPageCount}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next product page"
                  disabled={currentProductPage + 1 >= productPageCount}
                  onPress={() => changeProductPage(currentProductPage + 1)}
                  style={[
                    styles.catalogPageButton,
                    { backgroundColor: palette.accentSoft },
                    currentProductPage + 1 >= productPageCount && styles.dim,
                  ]}
                >
                  <Text
                    style={[
                      styles.catalogPageButtonText,
                      { color: currentProductPage + 1 >= productPageCount ? palette.muted : palette.accent },
                    ]}
                  >
                    Next
                  </Text>
                </Pressable>
              </View>
            ) : null
          ) : products.length > CUSTOMER_HOME_PRODUCT_LIMIT ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={wishlistOnly ? "View all saved products" : "Discover all available products"}
              onPress={openCatalog}
              style={[
                styles.discoverMoreCard,
                { backgroundColor: theme.isDark ? palette.elevated : "#edf3ff", borderColor: palette.border },
              ]}
            >
              <View style={[styles.discoverMoreIcon, { backgroundColor: palette.accentSoft }]}>
                <Icon name={wishlistOnly ? "heart" : "grid"} size={23} color={palette.accent} />
              </View>
              <View style={styles.discoverMoreCopy}>
                <Text style={[styles.discoverMoreTitle, { color: palette.text }]}>
                  {wishlistOnly ? "See all your saved items" : "Discover more"}
                </Text>
                <Text style={[styles.discoverMoreCaption, { color: palette.muted }]}>
                  {wishlistOnly
                    ? `Browse all ${products.length} wishlist items`
                    : search.trim()
                      ? `See all ${products.length} matching products`
                      : `Explore all ${products.length} products`}
                </Text>
              </View>
              <Icon name="arrow" size={21} color={palette.accent} />
            </Pressable>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={palette.accent} size="large" />
            ) : (
              <Icon
                name={wishlistOnly ? "heart" : "search"}
                size={36}
                color={palette.accent}
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
          const atLimit = quantity >= Math.min(item.stock, 5);
          const saved = wishlist.hasItem(item.id);
          return (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
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
                  onPress={() => toggleProductWishlist(item.id, saved)}
                  style={styles.heart}
                >
                  <Animated.View style={heartPulseId === item.id ? { transform: [{ scale: heartPulse }] } : undefined}>
                    <Icon name="heart" size={19} color={saved ? palette.accent : palette.muted} filled={saved} />
                  </Animated.View>
                </Pressable>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.productHeading}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${item.name}`}
                    onPress={() => setSelectedProduct(item)}
                    style={styles.productHeadingName}
                  >
                    <Text style={[styles.productName, { color: palette.text }]} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </Pressable>
                  {Number(item.reviewCount) > 0 && Number.isFinite(Number(item.averageRating)) && (
                    <Text
                      accessibilityLabel={`Rated ${Number(item.averageRating).toFixed(1)} out of 5 from ${item.reviewCount} reviews`}
                      style={styles.productRating}
                      numberOfLines={1}
                    >
                      ★ {Number(item.averageRating).toFixed(1)} ({item.reviewCount})
                    </Text>
                  )}
                </View>
                  <Text style={[styles.category, { color: palette.muted }]} numberOfLines={1}>
                  {item.category}
                </Text>
          {item.discountedPrice != null && item.discountCampaignId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Shop ${item.discountCampaignName || "sale"} products`}
                    onPress={() => openCampaign({ id: item.discountCampaignId, name: item.discountCampaignName || null })}
                    style={{ alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7, marginBottom: 4, borderRadius: 99, borderWidth: 1, borderColor: "#f3c66d", backgroundColor: theme.isDark ? "#3b2a16" : "#fff4dc", paddingHorizontal: 11, paddingVertical: 6 }}
                  >
                    <Text style={{ color: "#c05614", fontWeight: "900" }}>✦</Text>
                    <Text style={{ color: theme.isDark ? "#ffdf98" : "#713f12", fontSize: 12, fontWeight: "900", flexShrink: 1 }} numberOfLines={1}>{item.discountCampaignName || "Sale"}</Text>
                    <Text style={{ color: "#c05614", fontWeight: "900" }}>›</Text>
                  </Pressable>
                ) : null}
                {item.discountedPrice != null && <Text style={{ color: palette.danger, fontWeight: "800" }} numberOfLines={1}>{item.discountKind === "PERCENT" ? `${Number(item.discountValue)}% off` : `${formatPrice(item.discountAmount)} off`}</Text>}
                {item.discountedPrice != null && <Text style={{ color: palette.muted, textDecorationLine: "line-through", fontSize: 13 }}>{formatPrice(item.price)}</Text>}
                <Text style={[styles.price, { color: palette.accent }]} adjustsFontSizeToFit numberOfLines={1}>
                  {formatPrice(item.discountedPrice ?? item.price)}
                </Text>
                {quantity > 0 && !unavailable ? (
                  <View style={[styles.stepper, { backgroundColor: palette.accentSoft }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove one ${item.name}`}
                      disabled={cart.loading}
                      style={[styles.stepButton, { backgroundColor: palette.accentSoft }]}
                      onPress={() =>
                        quantity === 1
                          ? cart.removeItem(item.id)
                          : cart.changeQuantity(item.id, quantity - 1)
                      }
                    >
                      <Icon name="minus" size={19} color={palette.accent} />
                    </Pressable>
                    <Text style={[styles.quantity, { color: palette.text }]}>{quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add one ${item.name}`}
                      disabled={cart.loading || atLimit}
                      onPress={() => addProduct(item.id)}
                      style={[styles.stepButton, { backgroundColor: palette.accentSoft }, atLimit && styles.dim]}
                    >
                      <Icon name="plus" size={19} color={palette.accent} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name} to cart`}
                    disabled={cart.loading || unavailable || atLimit}
                    onPress={() => addProduct(item.id)}
                    style={[
                      styles.addButton,
                      { backgroundColor: palette.accent },
                      (cart.loading || unavailable || atLimit) &&
                        styles.disabled,
                    ]}
                  >
                    <Animated.View style={cartPulseId === item.id ? { transform: [{ scale: cartPulse }] } : undefined}>
                      <Icon name="cart" color={unavailable ? "#7b8498" : "#fff"} size={17} />
                    </Animated.View>
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

      <View style={[styles.bottomBar, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
        {[
          {
            name: "home",
            label: "Home",
            active: !wishlistOnly,
            action: () => {
              setCatalogOpen(false);
              setSelectedCampaign(null);
              setWishlistOnly(false);
              setCategory("All");
              setSearch("");
              resetProductPage();
            },
          },
          {
            name: "heart",
            label: "Wishlist",
            active: wishlistOnly,
            action: () => {
              setCatalogOpen(false);
              setSelectedCampaign(null);
              setWishlistOnly(true);
              setCategory("All");
              setSearch("");
              resetProductPage();
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
            style={[styles.bottomItem, item.active && { backgroundColor: palette.accentSoft }]}
          >
            <Icon
              name={item.name}
              size={23}
              color={item.active ? palette.accent : palette.muted}
            />
            <Text style={[styles.bottomLabel, { color: item.active ? palette.accent : palette.muted }]}>
              {item.label}
            </Text>
            <View
              style={[
                styles.indicator,
                { backgroundColor: item.active ? palette.accent : "transparent" },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open ShopMart assistant"
        onPress={() => setChatOpen(true)}
        style={[styles.assistantFab, { backgroundColor: palette.accent, borderColor: palette.background }]}
      >
        <Icon name="chat" size={25} color="#fff" />
      </Pressable>

      <Modal
        visible={categoryPickerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <SafeAreaView style={[styles.categoryPickerScreen, { backgroundColor: palette.background }]}>
          <View style={[styles.categoryPickerHeader, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
            <View style={styles.categoryPickerHeading}>
              <Text style={[styles.heroEyebrow, { color: palette.accent }]}>SHOPMART COLLECTION</Text>
              <Text style={[styles.catalogTitle, { color: palette.text }]}>All categories</Text>
              <Text style={[styles.sectionCaption, { color: palette.muted }]}>
                {categories.length - 1} categories available
              </Text>
            </View>
            <IconButton
              name="close"
              label="Close categories"
              color={palette.text}
              style={{ backgroundColor: palette.accentSoft, borderColor: palette.border }}
              onPress={() => setCategoryPickerOpen(false)}
            />
          </View>
          <View style={[styles.categoryPickerSearch, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Icon name="search" size={20} color={palette.muted} />
            <TextInput
              accessibilityLabel="Search categories"
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Search categories..."
              placeholderTextColor={palette.muted}
              autoCorrect={false}
              style={[styles.search, { color: palette.text }]}
            />
            {categorySearch ? (
              <IconButton
                name="close"
                label="Clear category search"
                onPress={() => setCategorySearch("")}
              />
            ) : null}
          </View>
          <FlatList
            data={matchingCategories}
            keyExtractor={(name) => name}
            contentContainerStyle={styles.categoryPickerList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={(
              <View style={styles.empty}>
                <Icon name="search" size={34} color={palette.accent} />
                <Text style={[styles.emptyText, { color: palette.muted }]}>No categories match your search.</Text>
              </View>
            )}
            renderItem={({ item: name }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: category === name }}
                onPress={() => {
                  setCategory(name);
                  resetProductPage();
                  setCategoryPickerOpen(false);
                }}
                style={[
                  styles.categoryPickerItem,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                  category === name && { backgroundColor: palette.accentSoft, borderColor: palette.accent },
                ]}
              >
                <View style={[styles.categoryPickerIcon, { backgroundColor: palette.accentSoft }]}>
                  <Icon name={name === "All" ? "grid" : /home/i.test(name) ? "home" : /fashion|cloth/i.test(name) ? "shirt" : "box"} size={19} color={palette.accent} />
                </View>
                <Text style={[styles.categoryPickerName, { color: palette.text }]}>
                  {name === "All" ? "All products" : name}
                </Text>
                <Text style={[styles.categoryPickerCount, { color: palette.muted }]}>
                  {name === "All" ? (result?.items || []).length : (result?.items || []).filter((item) => item.category === name).length}
                </Text>
                <Icon name={category === name ? "check" : "arrow"} size={17} color={palette.accent} />
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {selectedProduct && (
        <ProductDetailsModal
          key={selectedProduct.id}
          product={selectedProduct}
          session={auth.session}
          onRatingSummaryChange={updateRatingSummary}
          onCampaignClick={openCampaign}
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
          key={`${auth.session.user.id}:${returnOrderId || "all"}`}
          session={auth.session}
          orderId={returnOrderId}
          onClose={() => setReturnsOpen(false)}
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
      <AppearanceModal visible={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
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
          onViewProduct={(product) => {
            setCartOpen(false);
            setSelectedProduct(product);
          }}
          onPlaced={() => setReload((value) => value + 1)}
        />
      )}
      {accountOpen && auth.session && (
        <AccountModal
          session={auth.session}
          busy={auth.signingOut}
          error={auth.error}
          onClose={() => setAccountOpen(false)}
          language={languageSettings.language}
          onToggleLanguage={() => languageSettings.setLanguage(languageSettings.language === "en" ? "ur" : "en")}
          onAppearance={() => { setAccountOpen(false); setAppearanceOpen(true); }}
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
      <MobileLanguageProvider>
        <MobileAppearanceProvider>
          <ShopMart />
        </MobileAppearanceProvider>
      </MobileLanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbfafc" },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fbfafc",
  },
  cartToast: {
    position: "absolute",
    zIndex: 30,
    top: 68,
    left: 16,
    right: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    elevation: 6,
  },
  cartToastText: { color: "#065f46", fontSize: 13, fontWeight: "700", flex: 1 },
  cartToastLink: { color: "#047857", fontSize: 12, fontWeight: "900" },
  brand: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -1.3,
    color: "#20213a",
  },
  violet: { color: "#7c3aed" },
  headerActions: { flexDirection: "row", gap: 4 },
  iconButton: {
    width: 36,
    height: 38,
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
  homeHeader: { paddingBottom: 4 },
  homeHero: {
    minHeight: 190,
    marginBottom: 18,
    padding: 20,
    borderWidth: 1,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  homeHeroText: { flex: 1, minWidth: 0, zIndex: 1 },
  homeHeroTitle: { fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7 },
  homeHeroCaption: { marginTop: 7, fontSize: 12, lineHeight: 18 },
  homeHeroButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 13,
    minHeight: 39,
    borderRadius: 13,
  },
  homeHeroButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  homeHeroArt: {
    width: 73,
    height: 86,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-10deg" }],
  },
  homeHeroSpark: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  homeCategoryHeader: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  homeProductsHeading: { marginTop: 1, marginBottom: 2, flexDirection: "row", alignItems: "center", gap: 8 },
  clearWishlistButton: { minHeight: 39, paddingHorizontal: 10, borderRadius: 12, justifyContent: "center" },
  clearWishlistText: { fontSize: 10, fontWeight: "800" },
  catalogHeader: { paddingBottom: 8 },
  categoryPickerScreen: { flex: 1 },
  categoryPickerHeader: {
    minHeight: 104,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
  },
  categoryPickerHeading: { flex: 1, minWidth: 0 },
  categoryPickerSearch: {
    minHeight: 52,
    marginHorizontal: 16,
    marginTop: 15,
    paddingLeft: 14,
    paddingRight: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 15,
  },
  categoryPickerList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 9 },
  categoryPickerItem: {
    minHeight: 66,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
  },
  categoryPickerIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  categoryPickerName: { flex: 1, fontSize: 14, fontWeight: "800" },
  categoryPickerCount: { minWidth: 26, textAlign: "right", fontSize: 12, fontWeight: "700" },
  backHomeButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  backHomeText: { fontSize: 12, fontWeight: "800" },
  catalogTitleBlock: { marginTop: 13, marginBottom: 2 },
  catalogTitle: { fontSize: 29, lineHeight: 35, fontWeight: "900", letterSpacing: -0.7 },
  categoryLabel: { marginTop: 15, fontSize: 13, fontWeight: "800" },
  catalogListHeading: {
    marginTop: 2,
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  discoverMoreCard: {
    minHeight: 82,
    marginTop: 1,
    marginBottom: 18,
    padding: 15,
    borderWidth: 1,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  discoverMoreIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  discoverMoreCopy: { flex: 1, minWidth: 0 },
  discoverMoreTitle: { fontSize: 14, fontWeight: "900" },
  discoverMoreCaption: { marginTop: 4, fontSize: 11 },
  catalogPagination: {
    minHeight: 66,
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
  },
  catalogPageButton: {
    minWidth: 94,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  catalogPageButtonText: { fontSize: 12, fontWeight: "800" },
  catalogPageNumber: { fontSize: 13, fontWeight: "800" },
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
  viewAllCategoryChip: { borderStyle: "dashed" },
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
  productHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
  productHeadingName: { flex: 1, minWidth: 0 },
  productRating: { color: "#f59e0b", fontSize: 11, fontWeight: "800", flexShrink: 0, marginTop: 2 },
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
  assistantFab: {
    position: "absolute",
    right: 18,
    bottom: 88,
    zIndex: 20,
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    borderWidth: 3,
    elevation: 6,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
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
