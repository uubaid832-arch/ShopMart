import AdminCodModal from "./AdminCodModal";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ShoppingBag,
  Clock,
  Package,
  Wallet,
  RefreshCw,
  ArrowUpRight,
  Users,
  Bike,
} from "lucide-react";
import { useSession } from "../auth/useSession";
import { getAdminDashboard } from "../../api/adminDashboard";

const shortcuts = [
  { to: "/admin/products", label: "Manage products" },
  { to: "/admin/orders", label: "Manage orders" },
  { to: "/admin/deliveries", label: "Manage deliveries" },
  { to: "/admin/returns", label: "Review return requests" },
];

const statusColors = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  DISPATCHED: "bg-violet-50 text-violet-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const readable = (value = "") => value.replaceAll("_", " ").toLowerCase();

const formatPrice = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));

export default function AdminDashboard() {
  const { session } = useSession();
  const accessToken = session.accessToken;

  const [codOpen, setCodOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getAdminDashboard(accessToken, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({
            token: accessToken,
            reload,
            data,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token: accessToken,
            reload,
            data: null,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, reload]);

  const current = result?.token === accessToken && result?.reload === reload;

  const loading = !current;
  const summary = current ? result.data : null;
  const error = current ? result.error : "";

  const metrics = [
    {
      label: "Total orders",
      value: summary?.totalOrders,
      Icon: ShoppingBag,
      color: "bg-violet-50 text-violet-600",
    },
    {
      label: "Pending orders",
      value: summary?.pendingOrders,
      Icon: Clock,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Active products",
      value: summary?.activeProducts,
      Icon: Package,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Net paid revenue",
      value: summary
        ? formatPrice(summary.paidRevenue, summary.currency)
        : null,
      Icon: Wallet,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];
  const accountMetrics = [
    {
      label: "Active customers",
      value: summary?.activeCustomers,
      Icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Active riders",
      value: summary?.activeRiders,
      Icon: Bike,
      color: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            STORE OVERVIEW
          </p>
          <h1 className="mb-2 mt-2 text-3xl font-bold">Dashboard</h1>
          <p className="m-0 text-sm text-slate-500">
            Welcome back, {session.user.name}. Here’s your store overview.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => setReload((current) => current + 1)}
          className="flex items-center gap-2 rounded-xl border border-solid border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 enabled:hover:bg-violet-50 disabled:opacity-50"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <section aria-label="Store statistics" aria-busy={loading}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, Icon, color }) => (
            <article
              key={label}
              className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="m-0 text-sm font-medium text-slate-500">
                  {label}
                </h2>
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${color}`}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
              </div>

              <p className="mb-0 mt-4 break-words text-2xl font-extrabold text-slate-900">
                {loading ? "…" : (value ?? "—")}
              </p>
            </article>
          ))}
        </div>

        {loading && (
          <p role="status" className="mb-0 text-sm text-slate-500">
            Loading dashboard…
          </p>
        )}

        {summary && (
          <p className="mb-0 mt-3 text-xs text-slate-500">
            Collected COD and verified Safepay payments minus recorded refunds. Includes Safepay sandbox transactions for this project demo.
          </p>
        )}
      </section>
      {codOpen && <AdminCodModal token={accessToken} onClose={() => { setCodOpen(false); setReload(v => v + 1); }} />}
      {summary && <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
        <h2 className="mt-0 text-lg font-bold">Revenue & COD handovers</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <p>Gross paid <strong className="block">{formatPrice(summary.grossPaidRevenue)}</strong></p>
          <p>Refunded <strong className="block">{formatPrice(summary.refundedAmount)}</strong></p>
          <p>COD held by riders <strong className="block">{formatPrice(summary.codWithRiders)}</strong></p>
        </div>
        <button className="rounded-xl border-0 bg-violet-600 px-4 py-3 font-semibold text-white" onClick={() => setCodOpen(true)}>Review COD handovers ({summary.pendingCodHandovers ?? 0}) · {formatPrice(summary.pendingCodAmount)}</button>
        <p className="text-xs text-slate-500">Confirm only after receiving cash. A handover does not add revenue again.</p>
      </section>}
      <section
        aria-label="Active accounts"
        aria-busy={loading}
        className="grid gap-4 sm:grid-cols-2"
      >
        {accountMetrics.map(({ label, value, Icon, color }) => (
          <Link
            key={label}
            to="/admin/users"
            className="flex items-center gap-4 rounded-2xl border border-solid border-slate-200 bg-white p-4 no-underline transition hover:border-violet-400"
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-xl ${color}`}
            >
              <Icon size={21} aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-sm font-medium text-slate-500">
                {label}
              </h2>

              <p className="mb-0 mt-1 text-2xl font-extrabold text-slate-900">
                {loading ? "…" : (value ?? "—")}
              </p>
            </div>

            <ArrowUpRight
              size={18}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />
          </Link>
        ))}
      </section>

      {summary && (
        <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white">
            <header className="flex items-center justify-between gap-3 p-5">
              <h2 className="m-0 text-lg font-bold">Recent orders</h2>
              <Link
                to="/admin/orders"
                className="text-sm font-semibold text-violet-700"
              >
                View all →
              </Link>
            </header>

            {summary.recentOrders.length === 0 ? (
              <p className="m-0 px-5 pb-6 text-sm text-slate-500">
                No orders have been placed yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Five most recent orders</caption>

                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {["Customer / Order", "Status", "Total"].map((label) => (
                        <th key={label} scope="col" className="p-4">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {summary.recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-0 border-t border-solid border-slate-100"
                      >
                        <td className="p-4">
                          <p className="m-0 font-semibold">
                            {order.customerName}
                          </p>
                          <p className="mb-0 mt-1 break-all text-xs text-slate-400">
                            {order.orderNumber}
                          </p>
                          <time
                            dateTime={order.createdAt}
                            className="mt-1 block text-xs text-slate-500"
                          >
                            {new Date(order.createdAt).toLocaleDateString(
                              "en-PK",
                            )}
                          </time>
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-block rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                              statusColors[order.status] ??
                              "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {readable(order.status)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap p-4 font-semibold">
                          {formatPrice(order.total, order.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-bold">Low stock</h2>
              <Link
                to="/admin/products"
                className="text-sm font-semibold text-violet-700"
              >
                Products →
              </Link>
            </div>

            <p className="mb-4 mt-2 text-xs text-slate-500">
              Active products with five or fewer units. Up to eight shown.
            </p>

            {summary.lowStockProducts.length === 0 ? (
              <p className="m-0 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                No active products are running low.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {summary.lowStockProducts.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <span className="min-w-0 break-words text-sm font-semibold">
                      {product.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                        product.stock === 0
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {product.stock === 0
                        ? "Out of stock"
                        : `${product.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
        <h2 className="mb-4 mt-0 text-lg font-bold">Quick actions</h2>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-between gap-3 rounded-xl bg-violet-50 p-4 text-sm font-semibold text-violet-700 hover:bg-violet-100"
            >
              {label}
              <ArrowUpRight size={18} className="shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
