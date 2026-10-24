import { useState } from "react";

const statuses = [
  "Pending",
  "Confirmed",
  "Dispatched",
  "Delivered",
  "Returned",
  "Cancelled",
];
const statusColors = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-blue-100 text-blue-800",
  Dispatched: "bg-violet-100 text-violet-800",
  Delivered: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-rose-100 text-rose-800",
  Returned: "bg-slate-200 text-slate-700",
};
const formatPrice = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
  }).format(amount);

export default function AdminOrders({
  orders = [],
  loading = false,
  error = "",
  onView,
  onManage,
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const query = search.trim().toLowerCase();

  const filtered = orders.filter((order) => {
    const matchesSearch =
      `${order.orderNumber ?? order.id} ${order.customerName ?? ""}`
        .toLowerCase()
        .includes(query);

    return matchesSearch && (status === "All" || order.status === status);
  });

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-3xl font-bold">Orders</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">
          Review customer orders. Search and filters apply to this page.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <label className="grid gap-2 text-sm font-semibold">
          Search orders
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order number or customer name"
            className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Order status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-solid border-slate-200 bg-white p-3"
          >
            {["All", ...statuses].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section
        aria-label="Customer orders"
        aria-busy={loading}
        className="overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white"
      >
        {loading ? (
          <p role="status" className="m-0 p-6 text-slate-500">
            Loading orders…
          </p>
        ) : error ? (
          <p role="alert" className="m-0 p-6 text-rose-700">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="m-0 text-lg font-bold">
              {orders.length ? "No matching orders" : "No orders to display"}
            </h2>
            <p className="mb-0 mt-2 text-sm text-slate-500">
              {orders.length
                ? "Try another search or status."
                : "Customer orders will appear here after checkout."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Customer order list</caption>

              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Order", "Customer", "Total", "Status", "Actions"].map(
                    (label) => (
                      <th key={label} scope="col" className="p-4">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="border-0 border-t border-solid border-slate-100"
                  >
                    <td className="p-4">
                      <span className="block max-w-64 break-all text-xs font-semibold">
                        {order.orderNumber ?? order.id}
                      </span>
                    </td>
                    <td className="p-4">{order.customerName}</td>
                    <td className="whitespace-nowrap p-4">
                      {formatPrice(order.total, order.currency)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          statusColors[order.status] ?? statusColors.Returned
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!onView}
                          onClick={() => onView?.(order)}
                          aria-label={`View order ${order.orderNumber}`}
                          className="rounded-lg border-0 bg-violet-50 px-3 py-2 font-semibold text-violet-700 disabled:opacity-50"
                        >
                          View
                        </button>

                        <button
                          type="button"
                          disabled={!onManage}
                          onClick={() => onManage?.(order)}
                          aria-label={`Manage order ${order.orderNumber}`}
                          className="rounded-lg border-0 bg-violet-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
                        >
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
