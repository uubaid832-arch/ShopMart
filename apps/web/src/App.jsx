import { useState } from "react";
import "./App.css";
import { demoProducts } from "./data/demoProducts";
import { useCart } from "./features/cart/useCart";
import CartPanel from "./features/cart/CartPanel";
import ProductDetails from "./features/products/ProductDetails";
import { useWishlist } from "./features/wishlist/useWishlist";
import WishlistModal from "./features/wishlist/WishlistModal";
import AuthModal from "./features/auth/AuthModal";
import OrdersModal from "./features/orders/OrdersModal";
import CheckoutModal from "./features/checkout/CheckoutModal";
import NotificationsModal from "./features/notifications/NotificationsModal";
import ReturnsModal from "./features/return/ReturnsModal";
import TrackingModal from "./features/tracking/TrackingModal";
import Navbar from "./components/Navbar";
import ChatWidget from "./features/chatbot/ChatWidget";
import ProfileModal from "./features/account/ProfileModal";
import Recommendations from "./features/recommendations/Recommendations";

const categories = [
  "All",
  ...new Set(demoProducts.map((product) => product.category)),
];

const formatPrice = (price) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(price);

// Decorative illustrations drawn directly with SVG.
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
  const outOfStock = product.stock <= 0;
  const atLimit = quantity >= product.stock;

  const colors = {
    lavender: "bg-[#eeebfc] text-[#51478a]",
    peach: "bg-[#fbede5] text-[#925d44]",
    mint: "bg-[#e8f3ee] text-[#375f55]",
    sand: "bg-[#f8f1df] text-[#927131]",
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
      <div
        className={`relative grid h-56 place-items-center p-6 ${
          colors[product.color] ?? colors.lavender
        }`}
      >
        <span
          className={`absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold ${
            outOfStock ? "text-rose-700" : "text-emerald-700"
          }`}
        >
          {outOfStock ? "Out of stock" : "In stock"}
        </span>

        <button
          type="button"
          aria-pressed={isWishlisted}
          aria-label={`${isWishlisted ? "Remove" : "Save"} ${product.name} ${
            isWishlisted ? "from" : "to"
          } wishlist`}
          onClick={() => onToggleWishlist(product.id)}
          className={`absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full border-0 p-0 shadow-sm transition hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none ${
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

        <div className="w-full max-w-48">
          <ProductIllustration type={product.illustration} />
        </div>

        {quantity > 0 && (
          <span className="absolute bottom-3 right-3 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-violet-700">
            {quantity} in cart
          </span>
        )}
      </div>

      <div className="p-5">
        <p className="m-0 text-xs text-slate-500">{product.category}</p>
        <h3 className="mb-4 mt-2 text-base font-bold">{product.name}</h3>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-lg font-extrabold">
            {formatPrice(product.price)}
          </p>
          <span className="text-xs text-slate-500">
            {product.stock} available
          </span>
        </div>

        <button
          type="button"
          disabled={outOfStock || atLimit}
          onClick={() => onAdd(product)}
          className="mt-4 w-full rounded-xl border-0 bg-violet-100 p-3 font-semibold text-violet-700 transition enabled:hover:bg-violet-600 enabled:hover:text-white disabled:bg-slate-100 disabled:text-slate-500"
        >
          {outOfStock
            ? "Out of stock"
            : atLimit
              ? "Stock limit reached"
              : "＋ Add to cart"}
        </button>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`View details for ${product.name}`}
          onClick={() => onView(product)}
          className="mt-2 w-full rounded-lg border-0 bg-transparent p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
        >
          View details ↗
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const cart = useCart(demoProducts);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [notice, setNotice] = useState("");
  const query = search.trim().toLowerCase();
  const minimum = minPrice === "" ? 0 : Number(minPrice);
  const maximum = maxPrice === "" ? Infinity : Number(maxPrice);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const wishlist = useWishlist(demoProducts);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isReturnsOpen, setIsReturnsOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const priceError =
    (minPrice !== "" && !Number.isFinite(minimum)) ||
    (maxPrice !== "" && !Number.isFinite(maximum))
      ? "Enter a valid price."
      : minimum < 0 || maximum < 0
        ? "Prices cannot be negative."
        : minimum > maximum
          ? "Minimum price cannot exceed maximum price."
          : "";

  const filteredProducts = demoProducts.filter((product) => {
    const matchesSearch = `${product.name} ${product.category}`
      .toLowerCase()
      .includes(query);

    const matchesCategory =
      selectedCategory === "All" || product.category === selectedCategory;

    const matchesPrice = product.price >= minimum && product.price <= maximum;

    return !priceError && matchesSearch && matchesCategory && matchesPrice;
  });

  const visibleProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return 0;
  });

  const hasFilters =
    search !== "" ||
    selectedCategory !== "All" ||
    minPrice !== "" ||
    maxPrice !== "";

  function clearFilters() {
    setSearch("");
    setSelectedCategory("All");
    setMinPrice("");
    setMaxPrice("");
  }

  function handleAdd(product) {
    const quantity =
      cart.items.find((item) => item.id === product.id)?.quantity ?? 0;

    if (product.stock <= 0 || quantity >= product.stock) return;

    cart.addItem(product);
    setNotice(`${product.name} added to your cart.`);
  }

  return (
    <>
      <Navbar
        search={search}
        onSearch={setSearch}
        wishlistCount={wishlist.count}
        cartCount={cart.count}
        onAccount={() => setIsAuthOpen(true)}
        onOrders={() => setIsOrdersOpen(true)}
        onTracking={() => setIsTrackingOpen(true)}
        onReturns={() => setIsReturnsOpen(true)}
        onNotifications={() => setIsNotificationsOpen(true)}
        onWishlist={() => setIsWishlistOpen(true)}
        onCart={() => setIsCartOpen(true)}
        onProfile={() => setIsProfileOpen(true)}
      />

      <main id="top" className="mx-auto max-w-7xl scroll-mt-48 px-4 lg:px-6">
        <section
          aria-labelledby="hero-title"
          className="relative my-8 grid overflow-hidden rounded-3xl border border-solid border-violet-200 bg-linear-to-br from-violet-50 to-violet-200 p-6 sm:p-10 lg:grid-cols-2 lg:p-14"
        >
          <div className="relative z-10">
            <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
              EVERYDAY FINDS. ONE PLACE.
            </p>

            <h1
              id="hero-title"
              className="my-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl"
            >
              Little upgrades.
              <br />
              <span className="text-violet-600">Big everyday joy.</span>
            </h1>

            <p className="mb-6 max-w-md text-slate-600">
              Explore electronics, fashion and home essentials. Find something
              that fits your day.
            </p>

            <a
              href="#products"
              className="inline-flex items-center gap-6 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
            >
              Explore collection <span aria-hidden="true">↗</span>
            </a>

            <div className="mt-7 flex flex-wrap gap-4 text-xs text-slate-600">
              {["Electronics", "Fashion", "Home"].map((category) => (
                <span key={category}>
                  <span aria-hidden="true" className="mr-2 text-violet-600">
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

            <div className="absolute bottom-0 right-0 rounded-2xl bg-white/90 px-5 py-3 shadow-lg">
              <p className="m-0 text-xs tracking-widest text-slate-500">
                EVERYDAY ESSENTIAL
              </p>
              <p className="mb-0 mt-1 font-bold text-slate-800">
                Sound meets style.
              </p>
            </div>

            <span className="absolute right-2 top-0 text-4xl text-violet-600">
              ✦
            </span>
          </div>
        </section>

        <section
          id="products"
          aria-labelledby="products-title"
          className="scroll-mt-48 pb-8"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
                THE COLLECTION
              </p>
              <h2 id="products-title" className="mb-0 mt-2 text-3xl font-bold">
                Find your favourites
              </h2>
            </div>

            <p className="m-0 text-sm text-slate-500" aria-live="polite">
              {visibleProducts.length} products found
            </p>
          </div>

          <div className="rounded-2xl border border-solid border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div
                role="group"
                aria-label="Filter by category"
                className="flex flex-wrap gap-2"
              >
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-xl border-0 px-4 py-2 font-semibold ${
                      selectedCategory === category
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-violet-100"
                    }`}
                  >
                    {category === "All" ? "All products" : category}
                  </button>
                ))}
              </div>

              <label
                htmlFor="sort-products"
                className="flex items-center gap-2 text-sm text-slate-500"
              >
                Sort by
                <select
                  id="sort-products"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="min-w-0 rounded-lg border border-solid border-slate-200 bg-white p-2 text-slate-800"
                >
                  <option value="featured">Default order</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                  <option value="name">Name: A–Z</option>
                </select>
              </label>
            </div>

            <fieldset className="mx-0 mb-0 mt-5 min-w-0 border-0 border-t border-solid border-slate-200 px-0 pb-0 pt-4">
              <legend className="pr-3 text-xs font-semibold text-slate-500">
                Price range · PKR
              </legend>

              <div className="flex flex-wrap items-end gap-3">
                {[
                  {
                    id: "min-price",
                    label: "Minimum",
                    value: minPrice,
                    setValue: setMinPrice,
                  },
                  {
                    id: "max-price",
                    label: "Maximum",
                    value: maxPrice,
                    setValue: setMaxPrice,
                  },
                ].map(({ id, label, value, setValue }) => (
                  <label
                    key={id}
                    htmlFor={id}
                    className="grid min-w-0 flex-[1_1_140px] gap-2 text-xs text-slate-500 sm:max-w-48"
                  >
                    {label}
                    <input
                      id={id}
                      type="number"
                      min="0"
                      step="any"
                      placeholder={`No ${label.toLowerCase()}`}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      aria-invalid={Boolean(priceError)}
                      aria-describedby={priceError ? "price-error" : undefined}
                      className={`box-border w-full min-w-0 rounded-xl border border-solid bg-slate-50 p-3 text-slate-800 ${
                        priceError ? "border-rose-500" : "border-slate-200"
                      }`}
                    />
                  </label>
                ))}

                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-xl border-0 bg-violet-50 px-4 py-3 text-violet-700 hover:bg-violet-100 sm:ml-auto"
                  >
                    Clear filters ↺
                  </button>
                )}
              </div>

              {priceError && (
                <p
                  id="price-error"
                  role="alert"
                  className="mb-0 text-sm text-rose-700"
                >
                  {priceError}
                </p>
              )}
            </fieldset>
          </div>

          <div role="status" aria-live="polite" className="my-5">
            {notice && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <span>{notice}</span>

                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="ml-auto rounded-lg border-0 bg-transparent px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  View cart →
                </button>

                <button
                  type="button"
                  aria-label="Dismiss cart notification"
                  onClick={() => setNotice("")}
                  className="grid size-8 place-items-center rounded-lg border-0 bg-transparent text-emerald-800 hover:bg-emerald-100"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {visibleProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  quantity={
                    cart.items.find((item) => item.id === product.id)
                      ?.quantity ?? 0
                  }
                  onAdd={handleAdd}
                  onView={setSelectedProduct}
                  isWishlisted={wishlist.hasItem(product.id)}
                  onToggleWishlist={wishlist.toggleItem}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <h3 className="m-0 text-xl font-bold">No matches this time</h3>
              <p className="mb-6 text-slate-500">
                Check your search, category and price range.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-white hover:bg-violet-700"
              >
                Clear all filters
              </button>
            </div>
          )}
        </section>
        <Recommendations
          products={[]}
          renderProduct={(product) => (
            <ProductCard
              product={product}
              quantity={
                cart.items.find((item) => item.id === product.id)?.quantity ?? 0
              }
              onAdd={handleAdd}
              onView={setSelectedProduct}
              isWishlisted={wishlist.hasItem(product.id)}
              onToggleWishlist={wishlist.toggleItem}
              formatPrice={formatPrice}
            />
          )}
        />
      </main>
      <CartPanel
        cart={cart}
        formatPrice={formatPrice}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />
      {isCheckoutOpen && (
        <CheckoutModal
          cart={cart}
          formatPrice={formatPrice}
          onClose={() => setIsCheckoutOpen(false)}
        />
      )}
      {isReturnsOpen && (
        <ReturnsModal
          eligibleItems={[]}
          requests={[]}
          onClose={() => setIsReturnsOpen(false)}
        />
      )}
      {isWishlistOpen && (
        <WishlistModal
          wishlist={wishlist}
          products={demoProducts}
          cart={cart}
          formatPrice={formatPrice}
          onAdd={handleAdd}
          onClose={() => setIsWishlistOpen(false)}
        />
      )}
      {isTrackingOpen && (
        <TrackingModal orders={[]} onClose={() => setIsTrackingOpen(false)} />
      )}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
      {isOrdersOpen && (
        <OrdersModal
          orders={[]}
          formatPrice={formatPrice}
          onClose={() => setIsOrdersOpen(false)}
        />
      )}
      {isNotificationsOpen && (
        <NotificationsModal
          notifications={[]}
          onClose={() => setIsNotificationsOpen(false)}
        />
      )}
      {isProfileOpen && (
        <ProfileModal onClose={() => setIsProfileOpen(false)} />
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
      <footer className="mt-10 border-0 border-t border-solid border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
          <a href="#top" className="text-2xl font-extrabold">
            Shop<span className="text-violet-600">Mart</span>
          </a>

          <p className="m-0 text-xs text-slate-500">
            FYP development preview · Sample product data
          </p>

          <a href="#top" className="text-sm text-violet-700 hover:underline">
            Back to top ↑
          </a>
        </div>
      </footer>
      <ChatWidget />
    </>
  );
}
