import { NavLink, Outlet } from "react-router";

const links = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/deliveries", label: "Deliveries" },
  { to: "/admin/reviews", label: "Reviews" },
  { to: "/admin/returns", label: "Returns & refunds" },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-0 border-b border-solid border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <NavLink to="/" className="text-2xl font-extrabold">
            Shop<span className="text-violet-600">Mart</span>
          </NavLink>

          <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Admin UI preview · Authentication not connected
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[220px_1fr]">
        <aside className="self-start rounded-2xl border border-solid border-slate-200 bg-white p-3">
          <p className="mx-3 mb-3 text-xs font-bold tracking-widest text-slate-500">
            ADMINISTRATION
          </p>

          <nav aria-label="Admin navigation" className="grid gap-1">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3 text-sm font-semibold ${
                    isActive
                      ? "bg-violet-600 text-white"
                      : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
