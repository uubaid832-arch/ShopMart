import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Truck,
  Star,
  RotateCcw,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  Users,
  TicketPercent,
} from "lucide-react";
import { useSession } from "../auth/useSession";
import NotificationBell from "../notifications/NotificationBell";
import { getAdminDashboard } from "../../api/adminDashboard";
import AppearanceMenu from "../../components/AppearanceMenu";

const links = [
  {
    to: "/admin",
    label: "Dashboard",
    Icon: LayoutDashboard,
    end: true,
  },
  { to: "/admin/vouchers", label: "Vouchers", Icon: TicketPercent },
  { to: "/admin/products", label: "Products", Icon: Package },
  { to: "/admin/categories", label: "Categories", Icon: FolderTree },
  { to: "/admin/orders", label: "Orders", Icon: ShoppingBag },
  { to: "/admin/deliveries", label: "Deliveries", Icon: Truck },
  { to: "/admin/returns", label: "Returns & refunds", Icon: RotateCcw },
  { to: "/admin/reviews", label: "Reviews", Icon: Star },
  { to: "/admin/users", label: "Users & riders", Icon: Users },
];

export default function AdminLayout() {
  const { session, restoring, error, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    if (session?.user.role !== "ADMIN") return;
    const controller = new AbortController();
    let pending = false;
    async function refreshCounts() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const data = await getAdminDashboard(session.accessToken, controller.signal);
        if (!controller.signal.aborted) setCounts({token: session.accessToken, orders: data.pendingOrders, returns: data.pendingReturnRequests});
      } catch { /* Keep last confirmed counts until refresh succeeds. */ }
      finally { pending = false; }
    }
    refreshCounts();
    const timer = setInterval(refreshCounts, 15000);
    window.addEventListener("focus", refreshCounts);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refreshCounts); };
  }, [session?.accessToken, session?.user.role, location.pathname]);
  const navCounts = counts?.token === session?.accessToken ? counts : null;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      const success = await signOut();

      if (success) {
        navigate("/", { replace: true });
      }
    } finally {
      setSigningOut(false);
    }
  }

  if (restoring) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <p role="status" className="text-sm text-slate-500">
          Checking administrator access…
        </p>
      </main>
    );
  }

  if (session?.user.role !== "ADMIN") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <ShieldCheck size={30} aria-hidden="true" />
          </span>

          <h1 className="mb-3 mt-5 text-2xl font-bold text-slate-800">
            {session ? "Administrator access required" : "Sign in required"}
          </h1>

          <p className="mb-6 mt-0 text-sm leading-6 text-slate-500">
            {session
              ? "Your account does not have access to this workspace."
              : "Sign in with your administrator account to continue."}
          </p>

          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}

          <NavLink
            to="/"
            className="inline-block rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
          >
            Back to ShopMart
          </NavLink>
        </div>
      </main>
    );
  }

  const activePage =
    links
      .filter((link) =>
        link.end
          ? location.pathname === link.to
          : location.pathname.startsWith(link.to),
      )
      .at(-1)?.label ?? "Administration";

  const initials = session.user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-0 border-b border-solid border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <NavLink
              to="/admin"
              aria-label="ShopMart admin dashboard"
              className="flex shrink-0 items-center gap-2 text-xl font-extrabold"
            >
              <span className="grid size-10 -rotate-6 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
                S
              </span>
              <span className="hidden min-[400px]:inline">
                Shop<span className="text-violet-600">Mart</span>
              </span>
            </NavLink>

            <div className="hidden border-0 border-l border-solid border-slate-200 pl-4 md:block">
              <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Admin workspace
              </p>
              <p className="mb-0 mt-1 text-sm font-semibold">{activePage}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <NavLink
              to="/"
              title="Open storefront"
              aria-label="Open storefront"
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-violet-700 sm:flex"
            >
              Storefront
              <ArrowUpRight size={16} aria-hidden="true" />
            </NavLink>
            <AppearanceMenu />
            <NotificationBell />

            <div className="ml-1 flex items-center gap-3 border-0 border-l border-solid border-slate-200 pl-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-extrabold text-violet-700"
              >
                {initials}
              </span>

              <div className="hidden min-w-0 sm:block">
                <p className="m-0 max-w-40 truncate text-sm font-bold">
                  {session.user.name}
                </p>
                <p className="mb-0 mt-0.5 text-xs text-slate-400">
                  Administrator
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                title="Sign out"
                aria-label={signingOut ? "Signing out" : "Sign out"}
                className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-slate-400 transition enabled:hover:bg-rose-50 enabled:hover:text-rose-600 disabled:opacity-40"
              >
                <LogOut size={19} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-solid border-slate-200 bg-white p-3 lg:sticky lg:top-24">
          <p className="mx-3 mb-3 mt-2 hidden text-[10px] font-bold tracking-widest text-slate-400 lg:block">
            STORE MANAGEMENT
          </p>

          <nav
            aria-label="Admin navigation"
            className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0"
          >
            {links.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                {label}
                {(to === "/admin/orders" ? navCounts?.orders : to === "/admin/returns" ? navCounts?.returns : 0) > 0 &&
                  <span aria-label="Pending requests" className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">{to === "/admin/orders" ? navCounts.orders : navCounts.returns}</span>}
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/"
            className="mt-4 hidden items-center justify-between gap-2 border-0 border-t border-solid border-slate-100 px-3 pb-2 pt-4 text-xs font-semibold text-slate-400 hover:text-violet-700 lg:flex"
          >
            Visit storefront
            <ArrowUpRight size={15} aria-hidden="true" />
          </NavLink>
        </aside>

        <main className="min-w-0">
          {error && (
            <p
              role="alert"
              className="mb-5 mt-0 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
            >
              {error}
            </p>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
