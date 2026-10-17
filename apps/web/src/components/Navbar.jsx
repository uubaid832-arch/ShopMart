import { useEffect, useRef, useState } from "react";
import {
  Search,
  Bell,
  Heart,
  ShoppingCart,
  User,
  ChevronDown,
  Package,
  Truck,
  RotateCcw,
} from "lucide-react";

export default function Navbar({
  search,
  onSearch,
  wishlistCount,
  cartCount,
  onAccount,
  onOrders,
  onTracking,
  onReturns,
  onNotifications,
  onWishlist,
  onCart,
  onProfile,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const actions = [
    { label: "Notifications", Icon: Bell, onClick: onNotifications },
    {
      label: "Wishlist",
      Icon: Heart,
      onClick: onWishlist,
      count: wishlistCount,
    },
    {
      label: "Cart",
      Icon: ShoppingCart,
      onClick: onCart,
      count: cartCount,
    },
  ];

  const accountLinks = [
    { label: "Login / Register", Icon: User, onClick: onAccount },
    { label: "My Profile", Icon: User, onClick: onProfile },
    { label: "My Orders", Icon: Package, onClick: onOrders },
    { label: "Track Order", Icon: Truck, onClick: onTracking },
    { label: "Returns & Refunds", Icon: RotateCcw, onClick: onReturns },
  ];

  return (
    <header className="sticky top-0 z-20 border-0 border-b border-solid border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 lg:flex-nowrap lg:gap-6 lg:px-6">
        <a
          href="#top"
          aria-label="ShopMart home"
          className="flex shrink-0 items-center gap-2 text-xl font-extrabold sm:text-2xl"
        >
          <span className="grid size-9 -rotate-6 place-items-center rounded-xl bg-violet-600 text-white">
            S
          </span>
          <span className="hidden min-[400px]:inline">
            Shop<span className="text-violet-600">Mart</span>
          </span>
        </a>

        <div className="relative order-last w-full lg:order-none lg:mx-auto lg:max-w-xl lg:flex-1">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <Search
            size={19}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search products..."
            className="box-border w-full rounded-2xl border border-solid border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-800 focus:border-violet-500"
          />
        </div>

        <nav
          aria-label="Main navigation"
          className="flex shrink-0 items-center gap-1 sm:gap-2"
        >
          {actions.map(({ label, Icon, onClick, count }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              title={label}
              aria-label={
                count === undefined ? label : `${label}, ${count} items`
              }
              aria-haspopup="dialog"
              className="relative grid size-11 place-items-center rounded-xl border-0 bg-transparent p-0 text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
            >
              <Icon size={21} strokeWidth={1.8} aria-hidden="true" />

              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-violet-600 px-1 py-0.5 text-[10px] font-bold text-white"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          ))}

          <div
            ref={menuRef}
            className="relative ml-1"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setMenuOpen(false);
              }
            }}
          >
            <button
              ref={triggerRef}
              type="button"
              title="Account and orders"
              aria-label="Account and orders"
              aria-expanded={menuOpen}
              aria-controls="account-options"
              onClick={() => setMenuOpen((current) => !current)}
              className={`flex h-11 items-center gap-1 rounded-xl border border-solid px-3 ${
                menuOpen
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-violet-50"
              }`}
            >
              <User size={20} aria-hidden="true" />
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`transition ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen && (
              <div
                id="account-options"
                className="absolute right-0 top-full z-30 mt-3 w-60 overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white p-2 shadow-xl"
              >
                <p className="mb-2 mt-0 border-0 border-b border-solid border-slate-100 px-3 py-3 text-xs font-bold tracking-widest text-slate-400">
                  YOUR ACCOUNT
                </p>

                {accountLinks.map(({ label, Icon, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => {
                      triggerRef.current?.focus();
                      setMenuOpen(false);
                      onClick();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-3 text-left text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
