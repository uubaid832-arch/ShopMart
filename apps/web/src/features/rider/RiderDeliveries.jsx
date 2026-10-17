import { useState } from "react";

const sampleDeliveries = [
  {
    id: "sample-rider-delivery-1",
    orderNumber: "DEMO-RIDER-001",
    customerName: "Sample Customer",
    address: "Sample delivery address, Lahore",
    status: "Assigned",
    paymentMethod: "Cash on Delivery",
    amountToCollect: 4500,
  },
];

const formatPrice = (amount) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
  }).format(amount);

export default function RiderDeliveries() {
  const [status, setStatus] = useState("All");

  const filtered = sampleDeliveries.filter(
    (delivery) => status === "All" || delivery.status === status,
  );

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-3xl font-bold">My deliveries</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">
          View assigned deliveries and delivery instructions.
        </p>
      </header>

      <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sample assignment · Independent UI example, not a real delivery. Status
        updates and location sharing are not connected.
      </p>

      <label className="grid max-w-xs gap-2 text-sm font-semibold">
        Delivery status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-solid border-slate-200 bg-white p-3"
        >
          {["All", "Assigned", "Dispatched", "Delivered"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <p role="status" className="m-0 text-sm text-slate-500">
        {filtered.length} deliveries found
      </p>

      {filtered.length === 0 ? (
        <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
          No deliveries with this status.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0">
          {filtered.map((delivery) => (
            <li
              key={delivery.id}
              className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-bold">
                  {delivery.orderNumber}
                </h2>
                <span className="rounded-lg bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {delivery.status}
                </span>
              </div>

              <dl className="my-5 grid gap-3 text-sm">
                {[
                  ["Customer", delivery.customerName],
                  ["Address", delivery.address],
                  ["Payment", delivery.paymentMethod],
                  ["Amount to collect", formatPrice(delivery.amountToCollect)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-1 sm:grid-cols-[150px_1fr]"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="m-0 break-words font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap gap-3">
                {["Update status", "Share live location"].map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled
                    className="rounded-xl border-0 bg-slate-100 px-4 py-3 font-semibold text-slate-500"
                  >
                    {action}
                  </button>
                ))}
              </div>

              <p className="mb-0 mt-3 text-xs text-slate-500">
                Delivery actions require an authenticated rider and a connected
                backend. No location is collected in this preview.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
