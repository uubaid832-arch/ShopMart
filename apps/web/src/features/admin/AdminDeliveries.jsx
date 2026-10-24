import { useEffect, useState } from "react";
import { useSession } from "../auth/useSession";
import {
  getAdminDeliveries,
  getDeliveryRiders,
  assignDeliveryRider,
  updateDeliveryDetails,
} from "../../api/deliveries";
import AssignRiderModal from "./AssignRiderModal";
import DeliveryDetailsModal from "./DeliveryDetailsModal";
import WarehouseControls from "../delivery/WarehouseControls";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

export default function AdminDeliveries() {
  const { session } = useSession();
  const token = session?.accessToken;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    Promise.all([
      getAdminDeliveries(token, page, controller.signal),
      getDeliveryRiders(token, controller.signal),
    ])
      .then(([data, riders]) => {
        if (!controller.signal.aborted)
          setResult({ token, page, reload, data, riders, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            token,
            page,
            reload,
            data: null,
            riders: [],
            error: error.message,
          });
      });
    return () => controller.abort();
  }, [token, page, reload]);

  const current =
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload;
  const loading = !current;
  const data = current ? result.data : null;
  const error = current ? result.error : "";
  const query = search.trim().toLowerCase();
  const filtered = (data?.items ?? []).filter((delivery) =>
    `${delivery.orderNumber} ${delivery.customerName} ${delivery.address} ${delivery.phone} ${delivery.riderName ?? ""}`
      .toLowerCase()
      .includes(query),
  );

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-3xl font-bold">Deliveries</h1>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            Manage riders, correct delivery details and resolve warehouse
            returns.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => setReload((value) => value + 1)}
          className={buttonStyle}
        >
          Refresh
        </button>
      </header>
      {feedback && (
        <p
          role="status"
          className="m-0 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {feedback}
        </p>
      )}
      <label className="grid gap-2 text-sm font-semibold">
        Search this page
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Order, customer, phone, address or rider"
          className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
        />
      </label>
      <section aria-label="Deliveries" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading deliveries…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
            {query
              ? "No matching deliveries on this page."
              : "No deliveries on this page."}
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {filtered.map((delivery) => (
              <li
                key={delivery.orderId}
                className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="m-0 text-lg font-bold">
                      {delivery.customerName}
                    </h2>
                    <p className="mb-0 mt-1 break-all text-xs text-slate-400">
                      {delivery.orderNumber}
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold capitalize text-violet-700">
                    {delivery.status.toLowerCase()}
                  </span>
                </div>
                <dl className="my-5 grid gap-3 text-sm">
                  {[
                    ["Address", delivery.address],
                    ["Phone", delivery.phone],
                    [
                      "Rider",
                      delivery.riderName
                        ? `${delivery.riderName}${delivery.riderEnabled ? "" : " (disabled)"}`
                        : "Not assigned",
                    ],
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
                {delivery.failureReason && delivery.status === "DISPATCHED" && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    An unsuccessful attempt is recorded. Review the customer
                    details and warehouse return status.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {(delivery.status === "CONFIRMED" ||
                    (delivery.status === "DISPATCHED" &&
                      !delivery.riderId)) && (
                    <button
                      type="button"
                      onClick={() => setSelected(delivery)}
                      className="rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      {delivery.riderId ? "Change rider" : "Assign rider"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetails(delivery)}
                    className={buttonStyle}
                  >
                    Contact & delivery details
                  </button>
                </div>
                {delivery.failureReason && delivery.status === "DISPATCHED" && (
                  <div className="mt-4">
                    <WarehouseControls
                      key={`${delivery.orderId}:${reload}`}
                      token={token}
                      role="admin"
                      orderId={delivery.orderId}
                      riders={result?.riders ?? []}
                      riderId={delivery.riderId}
                      onChanged={(message) => {
                        setFeedback(message);
                        setReload((value) => value + 1);
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {data && data.totalPages > 1 && (
        <nav
          aria-label="Delivery pages"
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={loading || page === 0}
            onClick={() => setPage((value) => value - 1)}
            className={buttonStyle}
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={loading || page + 1 >= data.totalPages}
            onClick={() => setPage((value) => value + 1)}
            className={buttonStyle}
          >
            Next →
          </button>
        </nav>
      )}
      {selected && (
        <AssignRiderModal
          key={selected.orderId}
          delivery={selected}
          riders={result?.riders ?? []}
          onSave={async (riderId) => {
            await assignDeliveryRider(token, selected.orderId, riderId);
            setFeedback("Rider assignment saved.");
            setReload((value) => value + 1);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {details && (
        <DeliveryDetailsModal
          key={details.orderId}
          delivery={details}
          onSave={async (values) => {
            await updateDeliveryDetails(token, details.orderId, values);
            setFeedback("Delivery details updated and notifications sent.");
            setReload((value) => value + 1);
          }}
          onClose={() => setDetails(null)}
        />
      )}
    </div>
  );
}
