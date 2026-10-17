import { Link } from "react-router";

const shortcuts = [
  { to: "/admin/products", label: "Manage products" },
  { to: "/admin/orders", label: "Manage orders" },
  { to: "/admin/deliveries", label: "Manage deliveries" },
  { to: "/admin/returns", label: "Review return requests" },
];

export default function AdminDashboard({
  summary = null,
  loading = false,
  error = "",
}) {
  const metrics = [
    ["Total orders", summary?.totalOrders],
    ["Pending orders", summary?.pendingOrders],
    ["Active products", summary?.activeProducts],
    ["Pending returns", summary?.pendingReturns],
  ];

  return (
    <div className="grid gap-6">
      <header>
        <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
          STORE OVERVIEW
        </p>
        <h1 className="mb-2 mt-2 text-3xl font-bold">Dashboard</h1>
        <p className="m-0 text-sm text-slate-500">
          Monitor your store and access management tools.
        </p>
      </header>

      {error ? (
        <p role="alert" className="m-0 rounded-xl bg-rose-50 p-4 text-rose-700">
          {error}
        </p>
      ) : (
        <section aria-label="Store statistics" aria-busy={loading}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(([label, value]) => (
              <article
                key={label}
                className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
              >
                <h2 className="m-0 text-sm font-medium text-slate-500">
                  {label}
                </h2>
                <p className="mb-0 mt-3 text-3xl font-bold text-violet-700">
                  {loading ? "…" : (value ?? "—")}
                </p>
              </article>
            ))}
          </div>

          {loading ? (
            <p role="status" className="mb-0 text-sm text-slate-500">
              Loading store statistics…
            </p>
          ) : !summary ? (
            <p className="mb-0 text-sm text-slate-500">
              Statistics are unavailable until the backend is connected.
            </p>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
        <h2 className="mb-4 mt-0 text-lg font-bold">Quick actions</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {shortcuts.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-between gap-3 rounded-xl bg-violet-50 p-4 font-semibold text-violet-700 hover:bg-violet-100"
            >
              {label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
