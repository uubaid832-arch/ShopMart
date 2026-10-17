import { useState } from "react";

const sampleReturns = [
  {
    id: "DEMO-RETURN-001",
    orderNumber: "DEMO-RETURN-ORDER-001",
    customerName: "Sample Customer",
    productName: "Wireless Headphones",
    quantity: 1,
    reason: "Sample reason: item arrived damaged.",
    status: "Pending",
    refundStatus: "Not initiated",
  },
];

export default function AdminReturns() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const filtered = sampleReturns.filter((request) => {
    const matchesSearch =
      `${request.id} ${request.orderNumber} ${request.customerName} ${request.productName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());

    return matchesSearch && (status === "All" || request.status === status);
  });

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-3xl font-bold">Returns & refunds</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">
          Review return requests and monitor refund progress.
        </p>
      </header>

      <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sample request · Independent UI example, not a real return or refund.
        Processing is not connected.
      </p>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <label className="grid gap-2 text-sm font-semibold">
          Search requests
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Request, order, customer or product"
            className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Return status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-solid border-slate-200 bg-white p-3"
          >
            {["All", "Pending", "Approved", "Rejected"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" className="m-0 text-sm text-slate-500">
        {filtered.length} requests found
      </p>

      {filtered.length === 0 ? (
        <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
          No matching return requests.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0">
          {filtered.map((request) => (
            <li
              key={request.id}
              className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="m-0 text-lg font-bold">{request.id}</h2>
                <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {request.status}
                </span>
              </div>

              <dl className="my-5 grid gap-3 text-sm">
                {[
                  ["Order", request.orderNumber],
                  ["Customer", request.customerName],
                  ["Product", request.productName],
                  ["Quantity", request.quantity],
                  ["Reason", request.reason],
                  ["Refund status", request.refundStatus],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="grid gap-1 sm:grid-cols-[130px_1fr]"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="m-0 whitespace-pre-wrap break-words font-medium">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap gap-3">
                {["Approve return", "Reject return", "Process refund"].map(
                  (action) => (
                    <button
                      key={action}
                      type="button"
                      disabled
                      className="rounded-xl border-0 bg-slate-100 px-4 py-2 font-semibold text-slate-500"
                    >
                      {action}
                    </button>
                  ),
                )}
              </div>

              <p className="mb-0 mt-3 text-xs text-slate-500">
                Actions require backend eligibility checks and confirmation.
                Refund processing also depends on the payment method.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
