import { useState } from "react";

const statuses = [
  "Pending",
  "Confirmed",
  "Dispatched",
  "Delivered",
  "Returned",
  "Cancelled",
];

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
          Find customer orders and review their fulfilment status.
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
            className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
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
                : "Order data is not connected yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Customer order list</caption>

              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Order", "Customer", "Total", "Status", "Action"].map(
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
                    <td className="p-4 font-semibold">
                      {order.orderNumber ?? order.id}
                    </td>
                    <td className="p-4">
                      {order.customerName || "Guest customer"}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {formatPrice(order.total, order.currency)}
                    </td>
                    <td className="p-4">
                      <span className="inline-block rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold">
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        disabled={!onView}
                        onClick={() => onView?.(order)}
                        aria-label={`View order ${order.orderNumber ?? order.id}`}
                        className="rounded-lg border-0 bg-violet-50 px-3 py-2 font-semibold text-violet-700 enabled:hover:bg-violet-100 disabled:opacity-50"
                      >
                        View
                      </button>
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
