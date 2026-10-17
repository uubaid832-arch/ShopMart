import { useState } from "react";
import Modal from "../../components/Modal";

export default function TrackingModal({
  orders = [],
  loading = false,
  error = "",
  renderMap,
  onClose,
}) {
  const [selectedId, setSelectedId] = useState("");
  const order = orders.find((item) => String(item.id) === selectedId);

  return (
    <Modal onClose={onClose} labelledBy="tracking-title" size="lg">
      <header className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            YOUR DELIVERY
          </p>
          <h2 id="tracking-title" className="mb-0 mt-2 text-2xl font-bold">
            Track your order
          </h2>
        </div>

        <button
          type="button"
          aria-label="Close order tracking"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>

      <div className="p-5" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-slate-500">
            Loading tracking information…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">
            {error}
          </p>
        ) : orders.length === 0 ? (
          <div className="py-6 text-center">
            <h3 className="m-0 text-lg font-bold">No orders to track</h3>
            <p className="mb-0 text-sm text-slate-500">
              Orders available for tracking will appear here.
            </p>
          </div>
        ) : (
          <>
            <label
              htmlFor="tracking-order"
              className="grid gap-2 text-sm font-semibold"
            >
              Select an order
              <select
                id="tracking-order"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="min-w-0 rounded-xl border border-solid border-slate-200 bg-white p-3"
              >
                <option value="">Choose an order</option>
                {orders.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    Order #{item.id}
                  </option>
                ))}
              </select>
            </label>

            {order && (
              <>
                <section className="mt-5 rounded-xl bg-violet-50 p-4">
                  <h3 className="m-0 text-base font-bold">Delivery status</h3>
                  <p role="status" className="mb-0 text-violet-700">
                    {order.status || "Status unavailable"}
                  </p>

                  {order.estimatedDelivery && (
                    <p className="mb-0 text-sm text-slate-600">
                      Estimated delivery:{" "}
                      {new Date(order.estimatedDelivery).toLocaleString(
                        "en-PK",
                      )}
                    </p>
                  )}
                </section>

                <section className="mt-5">
                  <h3 className="mb-3 mt-0 text-base font-bold">
                    Delivery location
                  </h3>

                  {renderMap && order.location ? (
                    <div className="overflow-hidden rounded-xl border border-solid border-slate-200">
                      {renderMap(order)}
                    </div>
                  ) : (
                    <p className="m-0 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                      Live location is currently unavailable.
                    </p>
                  )}
                </section>

                <section className="mt-5">
                  <h3 className="mb-3 mt-0 text-base font-bold">
                    Tracking updates
                  </h3>

                  {order.events?.length ? (
                    <ul className="m-0 grid list-none gap-3 p-0">
                      {order.events.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-xl border border-solid border-slate-200 p-4"
                        >
                          <p className="m-0 text-sm font-semibold">
                            {event.message}
                          </p>
                          <time
                            dateTime={event.createdAt}
                            className="mt-2 block text-xs text-slate-500"
                          >
                            {new Date(event.createdAt).toLocaleString("en-PK")}
                          </time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No tracking updates available yet.
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
