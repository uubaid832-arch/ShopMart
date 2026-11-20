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
import { AlertTriangle, ArrowRight } from "lucide-react";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40 dark:bg-slate-700 dark:text-sky-200 dark:enabled:hover:bg-slate-600";

export default function AdminDeliveries() {
  const { session } = useSession();
  const token = session?.accessToken;
  const [search, setSearch] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const listRequest = getAdminDeliveries(
      token, page, controller.signal, failedOnly ? "FAILED" : "ALL",
    );
    const failedCountRequest = failedOnly
      ? listRequest
      : getAdminDeliveries(token, 0, controller.signal, "FAILED", 1);
    Promise.all([
      listRequest,
      getDeliveryRiders(token, controller.signal),
      failedCountRequest,
    ])
      .then(([data, riders, failedSummary]) => {
        if (!controller.signal.aborted)
          setResult({ token, page, reload, failedOnly, data, riders, failedCount: failedSummary.totalItems, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            token,
            page,
            reload,
            failedOnly,
            data: null,
            riders: [],
            failedCount: 0,
            error: error.message,
          });
      });
    return () => controller.abort();
  }, [token, page, reload, failedOnly]);

  const current =
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload &&
    result?.failedOnly === failedOnly;
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
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-solid border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/30">
        <div>
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertTriangle size={21} aria-hidden="true" />
            <h2 className="m-0 text-lg font-bold">Failed deliveries</h2>
          </div>
          <p className="mb-0 mt-2 text-sm text-rose-800 dark:text-rose-200">
            Review unsuccessful attempts and parcels reported returned to the warehouse.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFailedOnly(true);
            setPage(0);
            setSearch("");
            document.getElementById("deliveries-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          disabled={failedOnly}
          className="flex min-h-12 items-center justify-center gap-3 rounded-xl border-0 bg-rose-700 px-6 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-rose-800 disabled:cursor-default disabled:opacity-70 dark:bg-rose-600 dark:hover:bg-rose-500"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-white/15 text-base">{loading ? "…" : result?.failedCount ?? 0}</span>
          {failedOnly ? "Showing failed deliveries" : "View failed deliveries"}
          {!failedOnly && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </section>
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
        <div id="deliveries-list" className="mb-3 flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-bold">
            {failedOnly ? "Failed deliveries and warehouse returns" : "All deliveries"}
          </h2>
          {failedOnly && (
            <button
              type="button"
              onClick={() => { setFailedOnly(false); setPage(0); }}
              className={buttonStyle}
            >
              Show all deliveries
            </button>
          )}
        </div>
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
              : failedOnly
                ? "No unresolved failed deliveries or warehouse returns."
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold capitalize text-violet-700 dark:bg-slate-700 dark:text-sky-200">
                      {delivery.status.toLowerCase().replaceAll("_", " ")}
                    </span>
                    {delivery.warehouseReturned ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">Returned to warehouse</span>
                    ) : delivery.failureReason ? (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">Delivery unsuccessful</span>
                    ) : null}
                  </div>
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
                  <p className={`rounded-xl p-3 text-sm font-semibold ${delivery.warehouseReturned ? "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"}`}>
                    {delivery.warehouseReturned ? "The rider reports that this parcel was returned to the warehouse. Confirm receipt or resolve the delivery." : `The delivery attempt was unsuccessful (${delivery.failureReason.toLowerCase().replaceAll("_", " ")}). The parcel return is not yet reported.`}
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
