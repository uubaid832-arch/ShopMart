import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Bike, Truck, Wallet, LogOut, ArrowUpRight } from "lucide-react";
import { useSession } from "../auth/useSession";
import NotificationBell from "../notifications/NotificationBell";
import ChangePasswordButton from "../auth/ChangePasswordButton";
import Modal from "../../components/Modal";
import AppearanceMenu from "../../components/AppearanceMenu";
import { useLanguage } from "../language/useLanguage";

export default function RiderLayout() {
  const { session, restoring, error, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();

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
          Checking rider access…
        </p>
      </main>
    );
  }

  if (session?.user.role !== "RIDER") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <Bike size={30} aria-hidden="true" />
          </span>

          <h1 className="mb-3 mt-5 text-2xl font-bold">
            {session ? "Rider access required" : "Sign in required"}
          </h1>

          <p className="mb-6 mt-0 text-sm leading-6 text-slate-500">
            {session
              ? "Your account does not have access to the rider workspace."
              : "Sign in with your rider account to view assigned deliveries."}
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <NavLink
              to="/rider"
              aria-label="ShopMart rider workspace"
              className="flex items-center gap-2 text-xl font-extrabold"
            >
              <span className="grid size-10 -rotate-6 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
                S
              </span>
              <span className="hidden min-[400px]:inline">
                Shop<span className="text-violet-600">Mart</span>
              </span>
            </NavLink>

            <div className="hidden items-center gap-2 border-0 border-l border-solid border-slate-200 pl-4 md:flex">
              <Bike size={20} className="text-violet-600" aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-600">
                Rider workspace
              </span>
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

            <NotificationBell />

            <div className="ml-1 flex items-center gap-3 border-0 border-l border-solid border-slate-200 pl-3">
              <button type="button" onClick={() => setAccountOpen(true)} aria-label="Open my account settings" className="flex items-center gap-3 rounded-xl border-0 bg-transparent p-1 text-start hover:bg-violet-50">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-extrabold text-violet-700">{initials}</span>
                <span className="hidden sm:block"><span className="block max-w-40 truncate text-sm font-bold">{session.user.name}</span><span className="mt-0.5 block text-xs text-slate-400">Delivery rider</span></span>
              </button>

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

        <div className="border-0 border-t border-solid border-slate-100">
          <nav
            aria-label="Rider navigation"
            className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6"
          >
            <NavLink
              to="/rider"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`
              }
            >
              <Truck size={18} aria-hidden="true" />
              My deliveries
            </NavLink>

            <NavLink to="/rider/cash" className={({isActive}) => `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${isActive ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-violet-50"}`}><Wallet size={18}/>COD cash handovers</NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
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
      {accountOpen && (
        <Modal onClose={() => setAccountOpen(false)} labelledBy="rider-account-title" size="sm">
          <div className="grid gap-4 p-5">
            <header><p className="m-0 text-xs font-bold uppercase tracking-widest text-violet-600">Rider settings</p><h2 id="rider-account-title" className="mb-0 mt-2 text-2xl font-bold">My account</h2><p className="mb-0 mt-2 text-sm text-slate-500">{session.user.name} · {session.user.email}</p></header>
            <button type="button" onClick={() => setLanguage(language === "en" ? "ur" : "en")} className="flex w-full items-center justify-between gap-3 rounded-xl border border-solid border-slate-200 bg-white p-3 text-start hover:bg-violet-50"><span><strong className="block text-sm">App language</strong><small className="mt-1 block text-xs text-slate-500">Choose English or Urdu for ShopMart</small></span><span className="rounded-lg bg-violet-100 px-3 py-2 text-sm font-bold text-violet-700">{language === "ur" ? "اردو" : "English"}</span></button>
            <AppearanceMenu settings />
            <section className="rounded-xl border border-solid border-slate-200 p-3"><h3 className="mb-3 mt-0 text-sm font-bold">Password</h3><ChangePasswordButton /></section>
            <button type="button" onClick={() => setAccountOpen(false)} className="rounded-xl border-0 bg-slate-100 p-3 font-semibold text-slate-700 hover:bg-slate-200">Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
