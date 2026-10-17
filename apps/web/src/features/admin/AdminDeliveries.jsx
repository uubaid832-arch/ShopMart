import { useState } from "react";

const sampleDeliveries = [
  {
    id: "sample-delivery-1",
    orderNumber: "DEMO-DELIVERY-001",
    customerName: "Sample Customer",
    address: "Sample delivery address, Lahore",
    riderName: null,
    status: "Awaiting assignment",
  },
];

export default function AdminDeliveries() {
  const [search, setSearch] = useState("");

  const filtered = sampleDeliveries.filter((delivery) =>
    `${delivery.orderNumber} ${delivery.customerName} ${delivery.address}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-3xl font-bold">Deliveries</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">
          Review delivery assignments and fulfilment progress.
        </p>
      </header>

      <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sample delivery · Separate UI fixture, not a real shipment. Rider
        assignment and live tracking are not connected.
      </p>

      <label className="grid gap-2 text-sm font-semibold">
        Search deliveries
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Order number, customer or address"
          className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
        />
      </label>

      <p role="status" className="m-0 text-sm text-slate-500">
        {filtered.length} deliveries found
      </p>

      {filtered.length === 0 ? (
        <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
          No matching deliveries.
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
                <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {delivery.status}
                </span>
              </div>

              <dl className="my-5 grid gap-3 text-sm">
                {[
                  ["Customer", delivery.customerName],
                  ["Address", delivery.address],
                  ["Rider", delivery.riderName ?? "Not assigned"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-1 sm:grid-cols-[100px_1fr]"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="m-0 break-words font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              <button
                type="button"
                disabled
                className="rounded-xl border-0 bg-slate-100 px-4 py-3 font-semibold text-slate-500"
              >
                Assign rider
              </button>

              <p className="mb-0 mt-3 text-xs text-slate-500">
                Assignment will be enabled when rider data and the assignment
                service are connected.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
