import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getProducts } from "./api/products";
import "./App.css";

import { useCart } from "./features/cart/useCart";
import CartPanel from "./features/cart/CartPanel";
import ProductDetails from "./features/products/ProductDetails";
import { useWishlist } from "./features/wishlist/useWishlist";
import WishlistModal from "./features/wishlist/WishlistModal";
import AuthModal from "./features/auth/AuthModal";
import CustomerOrders from "./features/orders/CustomerOrders";
import CheckoutModal from "./features/checkout/CheckoutModal";
import ReturnsModal from "./features/return/ReturnsModal";
import TrackingModal from "./features/tracking/TrackingModal";
import Navbar from "./components/Navbar";
import ChatWidget from "./features/chatbot/ChatWidget";
import ProfileModal from "./features/account/ProfileModal";
import Recommendations from "./features/recommendations/Recommendations";
import { useSession } from "./features/auth/useSession";
import { useLanguage } from "./features/language/useLanguage";
import AboutModal from "./components/AboutModal";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(price);

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const defaultFilters = {
  search: "",
  category: "All",
  minPrice: "",
  maxPrice: "",
  sort: "featured",
  inStock: false,
};

const filterInput =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-sm text-slate-800";

const secondaryButton =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

function ProductIllustration({ type }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      className="product-illustration"
      aria-hidden="true"
    >
      <ellipse
        cx="120"
        cy="178"
        rx="64"
        ry="9"
        fill="currentColor"
        opacity=".1"
      />

      {type === "headphones" && (
        <>
          <path
            d="M65 111V88a55 55 0 0 1 110 0v23"
            stroke="currentColor"
            strokeWidth="17"
            strokeLinecap="round"
          />
          <path
            d="M65 91a55 55 0 0 1 110 0"
            stroke="white"
            strokeOpacity=".35"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect
            x="48"
            y="99"
            width="37"
            height="65"
            rx="16"
            fill="currentColor"
          />
          <rect
            x="155"
            y="99"
            width="37"
            height="65"
            rx="16"
            fill="currentColor"
          />
          <rect x="73" y="106" width="15" height="51" rx="7" fill="#a5a0ed" />
          <rect x="152" y="106" width="15" height="51" rx="7" fill="#a5a0ed" />
        </>
      )}

      {type === "backpack" && (
        <>
          <path
            d="M99 48V38a21 21 0 0 1 42 0v10"
            stroke="currentColor"
            strokeWidth="9"
          />
          <rect
            x="65"
            y="44"
            width="110"
            height="129"
            rx="32"
            fill="currentColor"
          />
          <rect x="79" y="106" width="82" height="52" rx="15" fill="#d99776" />
          <path d="M91 119h58M88 72h64" stroke="#ffe4d5" strokeWidth="4" />
          <path
            d="M65 78H55v67M175 78h10v67"
            stroke="currentColor"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <rect x="143" y="116" width="5" height="11" rx="2" fill="#ffe4d5" />
        </>
      )}

      {type === "coffee" && (
        <>
          <rect
            x="70"
            y="35"
            width="100"
            height="139"
            rx="15"
            fill="currentColor"
          />
          <rect x="82" y="48" width="76" height="30" rx="7" fill="#94c5b6" />
          <circle cx="145" cy="62" r="5" fill="#e2f9ef" />
          <path d="M86 93h68v60H86z" fill="#d9eee6" />
          <path
            d="M95 109h42v27a15 15 0 0 1-15 15h-12a15 15 0 0 1-15-15z"
            fill="white"
          />
          <path
            d="M137 114h7a10 10 0 0 1 0 20h-7"
            stroke="white"
            strokeWidth="6"
          />
          <path d="M113 83v10" stroke="#d9eee6" strokeWidth="6" />
          <path d="M79 165h82" stroke="#94c5b6" strokeWidth="5" />
        </>
      )}

      {type === "lamp" && (
        <>
          <path
            d="M119 163V107l35-44"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path d="m137 44 30 20-28 39-47-32z" fill="currentColor" />
          <path d="m92 71 47 32" stroke="#f6cd75" strokeWidth="7" />
          <circle cx="119" cy="108" r="9" fill="#dba849" />
          <path d="M79 173a40 19 0 0 1 80 0z" fill="currentColor" />
        </>
      )}

      {!["headphones", "backpack", "coffee", "lamp"].includes(type) && (
        <>
          <rect
            x="65"
            y="55"
            width="110"
            height="110"
            rx="16"
            stroke="currentColor"
            strokeWidth="8"
          />
          <path
            d="M65 90h110M120 55v110"
            stroke="currentColor"
            strokeWidth="6"
          />
        </>
      )}
    </svg>
  );
}

function ProductCard({
  product,
  quantity,
  onAdd,
  onView,
  isWishlisted,
  onToggleWishlist,
}) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);
  const [failedImages, setFailedImages] = useState([]);

  const outOfStock = product.stock <= 0;
  const atLimit = quantity >= product.stock;

  const colors = {
    lavender: "bg-[#eeebfc] text-[#51478a]",
    peach: "bg-[#fbede5] text-[#925d44]",
    mint: "bg-[#e8f3ee] text-[#375f55]",
    sand: "bg-[#f8f1df] text-[#927131]",
  };

  const imageUrls = [
    ...new Set(
      [
        product.imageUrl,
        ...(product.images ?? []).map((image) => image.url),
      ].filter(Boolean),
    ),
  ];

  const imageUrl = imageUrls.find((url) => !failedImages.includes(url));

  return (
    <article
      dir={direction}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div
        className={`relative box-border grid h-56 shrink-0 place-items-center p-5 ${
          imageUrl ? "bg-white" : (colors[product.color] ?? colors.lavender)
        }`}
      >
        <span
          className={`pointer-events-none absolute start-3 top-3 z-10 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold ${
            outOfStock ? "text-rose-700" : "text-emerald-700"
          }`}
        >
          {outOfStock
            ? text("Out of stock", "اسٹاک ختم")
            : text("In stock", "اسٹاک میں موجود")}
        </span>

        <button
          type="button"
          aria-pressed={isWishlisted}
          aria-label={
            isWishlisted
              ? text(
                  `Remove ${product.name} from wishlist`,
                  `${product.name} کو پسندیدہ مصنوعات سے ہٹائیں`,
                )
              : text(
                  `Save ${product.name} to wishlist`,
                  `${product.name} کو پسندیدہ مصنوعات میں شامل کریں`,
                )
          }
          onClick={() => onToggleWishlist(product.id)}
          className={`absolute end-3 top-3 z-20 grid size-10 place-items-center rounded-full border-0 p-0 shadow-sm transition hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none ${
            isWishlisted
              ? "bg-rose-600 text-white"
              : "bg-white text-rose-600 hover:bg-rose-50"
          }`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isWishlisted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onView(product)}
          aria-label={text(
            `View photos and details for ${product.name}`,
            `${product.name} کی تصاویر اور تفصیلات دیکھیں`,
          )}
          aria-haspopup="dialog"
          className="grid h-full w-full min-w-0 place-items-center overflow-hidden rounded-xl border-0 bg-transparent p-0 text-inherit"
        >
          {imageUrl ? (
            <img
              key={imageUrl}
              src={imageUrl}
              alt={product.name}
              width={320}
              height={224}
              loading="lazy"
              decoding="async"
              onError={() =>
                setFailedImages((current) =>
                  current.includes(imageUrl) ? current : [...current, imageUrl],
                )
              }
              className="h-full max-h-44 w-full object-contain"
            />
          ) : (
            <div className="w-full max-w-48">
              <ProductIllustration type={product.illustration} />
            </div>
          )}
        </button>

        {imageUrl && imageUrls.length > 1 && (
          <span className="pointer-events-none absolute bottom-3 start-3 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-slate-600">
            {text(`${imageUrls.length} photos`, `${imageUrls.length} تصاویر`)}
          </span>
        )}

        {quantity > 0 && (
          <span className="pointer-events-none absolute bottom-3 end-3 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-violet-700">
            {text(`${quantity} in cart`, `ٹوکری میں ${quantity}`)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="m-0 text-xs text-slate-500">
          <bdi>{product.category}</bdi>
        </p>

        <h3 className="mb-4 mt-2 break-words text-base font-bold">
          <bdi>{product.name}</bdi>
        </h3>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-lg font-extrabold">
            <bdi>{formatPrice(product.price)}</bdi>
          </p>
          <span className="text-xs text-slate-500">
            {text(`${product.stock} available`, `${product.stock} دستیاب`)}
          </span>
        </div>

        <button
          type="button"
          disabled={outOfStock || atLimit}
          onClick={() => onAdd(product)}
          className="mt-4 w-full rounded-xl border-0 bg-violet-100 p-3 font-semibold text-violet-700 transition enabled:hover:bg-violet-600 enabled:hover:text-white disabled:bg-slate-100 disabled:text-slate-500"
        >
          {outOfStock
            ? text("Out of stock", "اسٹاک ختم")
            : atLimit
              ? text("Stock limit reached", "دستیاب مقدار کی حد پوری")
              : text("＋ Add to cart", "＋ ٹوکری میں شامل کریں")}
        </button>

        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => onView(product)}
          aria-label={text(
            `View details for ${product.name}`,
            `${product.name} کی تفصیلات دیکھیں`,
          )}
          className="mt-2 w-full rounded-lg border-0 bg-transparent p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
        >
          {text("View details ↗", "تفصیلات دیکھیں ↖")}
        </button>
      </div>
    </article>
  );
}

function Storefront({ products }) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [notice, setNotice] = useState(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewedProductIds, setViewedProductIds] = useState([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isReturnsOpen, setIsReturnsOpen] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const {
    session,
    restoring,
    error: sessionError,
    signIn,
    signOut,
    saveProfile,
  } = useSession();

  const navigate = useNavigate();
  const cart = useCart(products, session?.user.id);
  const wishlist = useWishlist(products, session?.user.id);

  const catalog = products.filter((product) => product.active !== false);

  const categories = [
    "All",
    ...[...new Set(catalog.map((product) => product.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
  ];

  const selectedCategory = categories.includes(filters.category)
    ? filters.category
    : "All";

  const query = normalize(filters.search);
  const words = [...new Set(query.split(" ").filter(Boolean))];

  const minimum = filters.minPrice.trim() === "" ? 0 : Number(filters.minPrice);

  const maximum =
    filters.maxPrice.trim() === "" ? Infinity : Number(filters.maxPrice);

  const priceError =
    (filters.minPrice !== "" && !Number.isFinite(minimum)) ||
    (filters.maxPrice !== "" && !Number.isFinite(maximum))
      ? text("Enter a valid price.", "درست قیمت درج کریں۔")
      : minimum < 0 || maximum < 0
        ? text("Prices cannot be negative.", "قیمت منفی نہیں ہو سکتی۔")
        : minimum > maximum
          ? text(
              "Minimum price cannot exceed maximum price.",
              "کم سے کم قیمت، زیادہ سے زیادہ قیمت سے بڑھ نہیں سکتی۔",
            )
          : "";

  const matchingProducts = catalog
    .map((product, index) => {
      const name = normalize(product.name);
      const category = normalize(product.category);
      const searchable = normalize(
        `${product.name} ${product.category} ${product.description ?? ""}`,
      );

      const matchesSearch = words.every((word) => searchable.includes(word));

      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory;

      const matchesPrice =
        Number(product.price) >= minimum && Number(product.price) <= maximum;

      const matchesStock = !filters.inStock || product.stock > 0;

      const score = query
        ? (name === query ? 100 : name.includes(query) ? 50 : 0) +
          words.reduce(
            (total, word) =>
              total +
              (name.includes(word) ? 10 : category.includes(word) ? 5 : 1),
            0,
          )
        : 0;

      return {
        product,
        index,
        score,
        matches:
          !priceError &&
          matchesSearch &&
          matchesCategory &&
          matchesPrice &&
          matchesStock,
      };
    })
    .filter((entry) => entry.matches)
    .sort((a, b) => {
      const byName = a.product.name.localeCompare(
        b.product.name,
        language === "ur" ? "ur" : "en",
        { sensitivity: "base" },
      );

      if (filters.sort === "price-low") {
        return a.product.price - b.product.price || byName;
      }

      if (filters.sort === "price-high") {
        return b.product.price - a.product.price || byName;
      }

      if (filters.sort === "name") return byName;
      if (filters.sort === "name-desc") return -byName;

      return b.score - a.score || a.index - b.index;
    })
    .map(({ product }) => product);

  const totalItems = matchingProducts.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const startIndex = currentPage * pageSize;

  const visibleProducts = matchingProducts.slice(
    startIndex,
    startIndex + pageSize,
  );

  const firstItem = totalItems ? startIndex + 1 : 0;
  const lastItem = startIndex + visibleProducts.length;

  const firstPageButton = Math.max(
    0,
    Math.min(currentPage - 2, totalPages - 5),
  );

  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPageButton + index,
  );

  const hasFilters =
    filters.search !== "" ||
    selectedCategory !== "All" ||
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.inStock ||
    filters.sort !== "featured";

  function updateFilters(values) {
    setFilters((current) => ({ ...current, ...values }));
    setPage(0);
  }

  function clearFilters() {
    setFilters({ ...defaultFilters });
    setPage(0);
  }

  function handleViewProduct(product) {
    setSelectedProduct(product);

    setViewedProductIds((current) =>
      [product.id, ...current.filter((id) => id !== product.id)].slice(0, 12),
    );
  }

  function handleAdd(product) {
    const quantity =
      cart.items.find((item) => item.id === product.id)?.quantity ?? 0;

    if (product.stock <= 0 || quantity >= product.stock) return;

    cart.addItem(product);
    setNotice({ name: product.name });
  }

  function renderProduct(product) {
    return (
      <ProductCard
        key={product.id}
        product={product}
        quantity={
          cart.items.find((item) => item.id === product.id)?.quantity ?? 0
        }
        onAdd={handleAdd}
        onView={handleViewProduct}
        isWishlisted={wishlist.hasItem(product.id)}
        onToggleWishlist={wishlist.toggleItem}
      />
    );
  }

  async function handleSignOut() {
    const signedOut = await signOut();

    if (signedOut) {
      setIsProfileOpen(false);
      setIsOrdersOpen(false);
      setIsTrackingOpen(false);
      setIsReturnsOpen(false);
      setIsCheckoutOpen(false);
    }
  }

  return (
    <>
      {restoring && (
        <p
          dir={direction}
          role="status"
          className="m-0 bg-violet-50 px-4 py-2 text-center text-sm text-violet-700"
        >
          {text("Checking sign-in…", "سائن اِن کی جانچ ہو رہی ہے…")}
        </p>
      )}

      {sessionError && (
        <p
          dir={direction}
          role="alert"
          className="m-0 bg-rose-50 px-4 py-3 text-center text-sm text-rose-700"
        >
          {text(
            sessionError,
            "اکاؤنٹ کی کارروائی مکمل نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
          )}
        </p>
      )}

      <Navbar
        search={filters.search}
        isSignedIn={Boolean(session)}
        onSearch={(value) => updateFilters({ search: value })}
        wishlistCount={wishlist.count}
        cartCount={cart.count}
        onSignOut={handleSignOut}
        onAccount={() => {
          if (restoring) return;
          if (session) setIsProfileOpen(true);
          else setIsAuthOpen(true);
        }}
        onOrders={() => {
          if (restoring) return;
          if (!session) setIsAuthOpen(true);
          else setIsOrdersOpen(true);
        }}
        onTracking={() => { setTrackingOrderId(null); setIsTrackingOpen(true); }}
        onReturns={() => { setReturnOrderId(null); setIsReturnsOpen(true); }}
        onWishlist={() => setIsWishlistOpen(true)}
        onCart={() => setIsCartOpen(true)}
        onProfile={() => setIsProfileOpen(true)}
        onAbout={() => setIsAboutOpen(true)}
      />

      <main
        id="top"
        dir={direction}
        className="mx-auto max-w-7xl scroll-mt-48 px-4 lg:px-6"
      >
        <section
          aria-labelledby="hero-title"
          className="relative my-8 grid overflow-hidden rounded-3xl border border-solid border-violet-200 bg-linear-to-br from-violet-50 to-violet-200 p-6 sm:p-10 lg:grid-cols-2 lg:p-14"
        >
          <div className="relative z-10">
            <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
              {text(
                "EVERYDAY FINDS. ONE PLACE.",
                "روزمرہ کی ضروریات، ایک جگہ۔",
              )}
            </p>

            <h1
              id="hero-title"
              className="mb-5 mt-4 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl"
            >
              {text("Little upgrades.", "چھوٹی تبدیلیاں۔")}
              <br />
              <span className="text-violet-700">
                {text("Big everyday joy.", "روزمرہ کی بڑی خوشیاں۔")}
              </span>
            </h1>

            <p className="mb-6 max-w-md text-sm leading-7 text-slate-600">
              {text(
                "Explore everyday essentials and discover your next favourite.",
                "روزمرہ کی ضروریات دیکھیں اور اپنی پسند کی مصنوعات تلاش کریں۔",
              )}
            </p>

            <a
              href="#products"
              className="inline-flex items-center gap-6 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
            >
              {text("Explore collection", "مصنوعات دیکھیں")}
              <span aria-hidden="true">{text("↗", "↖")}</span>
            </a>

            <div className="mt-7 flex flex-wrap gap-4 text-xs text-slate-600">
              {[
                text("Electronics", "الیکٹرانکس"),
                text("Fashion", "فیشن"),
                text("Home", "گھر"),
              ].map((category) => (
                <span key={category}>
                  <span aria-hidden="true" className="me-2 text-violet-600">
                    •
                  </span>
                  {category}
                </span>
              ))}
            </div>
          </div>

          <div
            aria-hidden="true"
            className="relative mt-8 grid min-h-64 place-items-center lg:mt-0"
          >
            <div className="absolute size-56 rounded-full border border-solid border-white/70 bg-white/25 sm:size-64" />

            <div className="relative w-full max-w-80 -rotate-12 text-violet-800 drop-shadow-xl">
              <ProductIllustration type="headphones" />
            </div>

            <div className="absolute bottom-0 end-0 rounded-2xl bg-white/90 px-5 py-3 shadow-lg">
              <p className="m-0 text-xs tracking-widest text-slate-500">
                {text("EVERYDAY ESSENTIAL", "روزمرہ کی ضرورت")}
              </p>
              <p className="mb-0 mt-1 font-bold text-slate-800">
                {text("Sound meets style.", "آواز اور انداز کا حسین امتزاج۔")}
              </p>
            </div>
          </div>
        </section>

        <section
          id="products"
          aria-labelledby="products-title"
          className="scroll-mt-48 pb-8"
        >
          <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
                {text("THE COLLECTION", "ہماری مصنوعات")}
              </p>

              <h2 id="products-title" className="mb-0 mt-2 text-3xl font-bold">
                {text("Find your favourites", "اپنی پسند کی مصنوعات تلاش کریں")}
              </h2>
            </div>

            <p role="status" className="m-0 text-sm text-slate-500">
              {priceError
                ? text("Check the price range", "قیمت کی حد چیک کریں")
                : text(
                    `${totalItems} products found`,
                    `${totalItems} مصنوعات ملیں`,
                  )}
            </p>
          </header>

          <div className="grid gap-5 rounded-2xl border border-solid border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div
                role="group"
                aria-label={text(
                  "Filter by category",
                  "قسم کے مطابق فلٹر کریں",
                )}
                className="flex flex-wrap gap-2"
              >
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selectedCategory === category}
                    onClick={() => updateFilters({ category })}
                    className={`rounded-xl border-0 px-4 py-2 text-sm font-semibold ${
                      selectedCategory === category
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-violet-100"
                    }`}
                  >
                    <bdi>
                      {category === "All"
                        ? text("All products", "تمام مصنوعات")
                        : category}
                    </bdi>
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-500">
                {text("Sort by", "ترتیب")}
                <select
                  value={filters.sort}
                  onChange={(event) =>
                    updateFilters({ sort: event.target.value })
                  }
                  className="min-w-0 rounded-lg border border-solid border-slate-200 bg-white p-2 text-slate-800"
                >
                  <option value="featured">
                    {query
                      ? text("Best match", "بہترین مطابقت")
                      : text("Default order", "بنیادی ترتیب")}
                  </option>
                  <option value="price-low">
                    {text("Price: low to high", "قیمت: کم سے زیادہ")}
                  </option>
                  <option value="price-high">
                    {text("Price: high to low", "قیمت: زیادہ سے کم")}
                  </option>
                  <option value="name">{text("Name: A–Z", "نام: A–Z")}</option>
                  <option value="name-desc">
                    {text("Name: Z–A", "نام: Z–A")}
                  </option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-0 border-t border-solid border-slate-200 pt-4">
              {[
                ["minPrice", text("Minimum price · PKR", "کم سے کم قیمت")],
                [
                  "maxPrice",
                  text("Maximum price · PKR", "زیادہ سے زیادہ قیمت"),
                ],
              ].map(([name, label]) => (
                <label
                  key={name}
                  className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-slate-500 sm:max-w-48"
                >
                  {label}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters[name]}
                    placeholder={text("Any", "کوئی بھی")}
                    onChange={(event) =>
                      updateFilters({ [name]: event.target.value })
                    }
                    aria-invalid={Boolean(priceError)}
                    aria-describedby={priceError ? "price-error" : undefined}
                    className={`${filterInput} ${
                      priceError ? "border-rose-500" : ""
                    }`}
                  />
                </label>
              ))}

              <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={filters.inStock}
                  onChange={(event) =>
                    updateFilters({ inStock: event.target.checked })
                  }
                  className="m-0 size-4 accent-violet-600"
                />
                {text("In stock only", "صرف دستیاب مصنوعات")}
              </label>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${secondaryButton} py-3 sm:ms-auto`}
                >
                  {text("Clear filters ↺", "فلٹرز صاف کریں ↺")}
                </button>
              )}
            </div>

            {priceError && (
              <p
                id="price-error"
                role="alert"
                className="m-0 text-sm text-rose-700"
              >
                {priceError}
              </p>
            )}

            {query && (
              <p className="m-0 break-words text-xs text-slate-500">
                {text("Searching for:", "تلاش:")}{" "}
                <bdi>“{filters.search.trim()}”</bdi>
              </p>
            )}
          </div>

          {notice && (
            <div
              role="status"
              className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <span>
                <bdi>{notice.name}</bdi>{" "}
                {text("added to your cart.", "آپ کی ٹوکری میں شامل ہو گیا۔")}
              </span>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="ms-auto rounded-lg border-0 bg-transparent px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                {text("View cart →", "ٹوکری دیکھیں ←")}
              </button>

              <button
                type="button"
                aria-label={text("Dismiss notification", "اطلاع بند کریں")}
                onClick={() => setNotice(null)}
                className="grid size-8 place-items-center rounded-lg border-0 bg-transparent text-emerald-800 hover:bg-emerald-100"
              >
                ×
              </button>
            </div>
          )}

          {priceError ? (
            <p className="my-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
              {text(
                "Correct the price range to view matching products.",
                "مصنوعات دیکھنے کے لیے قیمت کی حد درست کریں۔",
              )}
            </p>
          ) : totalItems > 0 ? (
            <>
              <div className="my-5 flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-sm text-slate-500">
                  {text(
                    `Showing ${firstItem}–${lastItem} of ${totalItems} products`,
                    `${totalItems} میں سے ${firstItem} تا ${lastItem} مصنوعات`,
                  )}
                </p>

                <label className="flex items-center gap-2 text-sm text-slate-500">
                  {text("Per page", "فی صفحہ")}
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(0);
                    }}
                    className="rounded-lg border border-solid border-slate-200 bg-white p-2 text-slate-800"
                  >
                    {[12, 24, 48].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {visibleProducts.map(renderProduct)}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label={text("Product pages", "مصنوعات کے صفحات")}
                  className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-solid border-slate-200 bg-white p-4"
                >
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                    className={secondaryButton}
                  >
                    {text("← Previous", "پچھلا →")}
                  </button>

                  <div className="flex flex-wrap gap-1">
                    {pageNumbers.map((number) => (
                      <button
                        key={number}
                        type="button"
                        aria-label={text(
                          `Page ${number + 1}`,
                          `صفحہ ${number + 1}`,
                        )}
                        aria-current={
                          currentPage === number ? "page" : undefined
                        }
                        onClick={() => setPage(number)}
                        className={`grid size-9 place-items-center rounded-lg border-0 text-sm font-semibold ${
                          currentPage === number
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-violet-100"
                        }`}
                      >
                        {number + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={currentPage + 1 >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className={secondaryButton}
                  >
                    {text("Next →", "اگلا ←")}
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <h3 className="m-0 text-xl font-bold">
                {text("No matching products", "کوئی متعلقہ مصنوع نہیں ملی")}
              </h3>

              <p className="mb-6 text-slate-500">
                {text(
                  "Try fewer search words or adjust the category, price and availability filters.",
                  "تلاش کے الفاظ کم کریں یا قسم، قیمت اور دستیابی کے فلٹرز تبدیل کریں۔",
                )}
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
              >
                {text("Clear all filters", "تمام فلٹرز صاف کریں")}
              </button>
            </div>
          )}
        </section>

        <Recommendations
          products={catalog}
          cartItems={cart.items}
          viewedProductIds={viewedProductIds}
          renderProduct={renderProduct}
        />
      </main>

      <CartPanel
        cart={cart}
        formatPrice={formatPrice}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);

          if (restoring) return;

          if (!session || session.expiresAt <= Date.now()) {
            setIsAuthOpen(true);
            return;
          }

          setIsCheckoutOpen(true);
        }}
      />

      {isCheckoutOpen && session && (
        <CheckoutModal
          key={session.user.id}
          cart={cart}
          formatPrice={formatPrice}
          session={session}
          onClose={() => setIsCheckoutOpen(false)}
        />
      )}

      {isReturnsOpen && (
        <ReturnsModal
          key={`${session?.user.id ?? "guest"}-${returnOrderId ?? "all"}`}
          accessToken={session?.accessToken}
          orderId={returnOrderId}
          onClose={() => { setIsReturnsOpen(false); setReturnOrderId(null); }}
        />
      )}

      {isWishlistOpen && (
        <WishlistModal
          wishlist={wishlist}
          products={catalog}
          cart={cart}
          formatPrice={formatPrice}
          onAdd={handleAdd}
          onClose={() => setIsWishlistOpen(false)}
        />
      )}

      {isTrackingOpen && (
        <TrackingModal
          key={`${session?.user.id ?? "guest"}-${trackingOrderId ?? "all"}`}
          accessToken={session?.accessToken}
          initialOrderId={trackingOrderId}
          onClose={() => { setIsTrackingOpen(false); setTrackingOrderId(null); }}
        />
      )}

      {isAuthOpen && (
        <AuthModal
          onAuthenticated={(authenticatedSession) => {
            signIn(authenticatedSession);

            if (authenticatedSession.user.role === "ADMIN") {
              navigate("/admin", { replace: true });
            } else if (authenticatedSession.user.role === "RIDER") {
              navigate("/rider", { replace: true });
            }
          }}
          onClose={() => setIsAuthOpen(false)}
        />
      )}

      {isOrdersOpen && session && (
        <CustomerOrders
          key={session.user.id}
          accessToken={session.accessToken}
          formatPrice={formatPrice}
          onClose={() => setIsOrdersOpen(false)}
          onTrackOrder={(id) => { setIsOrdersOpen(false); setTrackingOrderId(id); setIsTrackingOpen(true); }}
          onReturnOrder={(id) => { setIsOrdersOpen(false); setReturnOrderId(id); setIsReturnsOpen(true); }}
        />
      )}

      {isProfileOpen && (
        <ProfileModal
          profile={session?.user ?? null}
          loading={restoring}
          accessToken={session?.accessToken}
          onSave={saveProfile}
          onLogout={handleSignOut}
          onClose={() => setIsProfileOpen(false)}
        />
      )}

      <ProductDetails
        product={selectedProduct}
        quantity={
          selectedProduct
            ? (cart.items.find((item) => item.id === selectedProduct.id)
                ?.quantity ?? 0)
            : 0
        }
        formatPrice={formatPrice}
        onAdd={handleAdd}
        onClose={() => setSelectedProduct(null)}
      >
        {selectedProduct && (
          <ProductIllustration type={selectedProduct.illustration} />
        )}
      </ProductDetails>

      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}

      <footer
        dir={direction}
        className="mt-10 border-0 border-t border-solid border-slate-200 bg-white py-6"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
          <a href="#top" className="text-2xl font-extrabold">
            <bdi>
              Shop<span className="text-violet-600">Mart</span>
            </bdi>
          </a>

          <p className="m-0 text-xs text-slate-500">
            {text(
              "ShopMart · Final year project",
              "شاپ مارٹ · فائنل ایئر پروجیکٹ",
            )}
          </p>

          <a href="#top" className="text-sm text-violet-700 hover:underline">
            {text("Back to top ↑", "واپس اوپر جائیں ↑")}
          </a>
        </div>
      </footer>

      <ChatWidget products={catalog} />
    </>
  );
}

export default function App() {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    getProducts(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setProducts(items);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(failure.message || "Could not load products.");
        }
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <main dir={direction} className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-2xl font-bold">
          {text("Could not load the catalog", "مصنوعات لوڈ نہیں ہو سکیں")}
        </h1>

        <p role="alert" className="text-rose-700">
          {text(
            error,
            "مصنوعات حاصل نہیں ہو سکیں۔ اپنا کنکشن چیک کرکے دوبارہ کوشش کریں۔",
          )}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white"
        >
          {text("Try again", "دوبارہ کوشش کریں")}
        </button>
      </main>
    );
  }

  if (products === null) {
    return (
      <main dir={direction} className="p-10 text-center">
        <p role="status" className="text-slate-500">
          {text(
            "Loading ShopMart products…",
            "شاپ مارٹ کی مصنوعات لوڈ ہو رہی ہیں…",
          )}
        </p>
      </main>
    );
  }

  return <Storefront products={products} />;
}
