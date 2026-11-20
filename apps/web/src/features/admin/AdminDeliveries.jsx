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
import { AlertTriangle, ArrowRight, Warehouse } from "lucide-react";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40 dark:bg-slate-700 dark:text-sky-200 dark:enabled:hover:bg-slate-600";

export default function AdminDeliveries() {
  const { session } = useSession();
  const token = session?.accessToken;
  const [search, setSearch] = useState("");
  const [failureView, setFailureView] = useState("ALL");
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
      token, page, controller.signal, failureView,
    );
    Promise.all([
      listRequest,
      getDeliveryRiders(token, controller.signal),
      getAdminDeliveries(token, 0, controller.signal, "FAILED", 1),
      getAdminDeliveries(token, 0, controller.signal, "WAREHOUSE_RETURN", 1),
    ])
      .then(([data, riders, failedSummary, warehouseSummary]) => {
        if (!controller.signal.aborted)
          setResult({
            token, page, reload, failureView, data, riders,
            failedCount: failedSummary.totalItems,
            warehouseReturnCount: warehouseSummary.totalItems,
            error: "",
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            token,
            page,
            reload,
            failureView,
            data: null,
            riders: [],
            failedCount: 0,
            warehouseReturnCount: 0,
            error: error.message,
          });
      });
    return () => controller.abort();
  }, [token, page, reload, failureView]);

  const current =
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload &&
    result?.failureView === failureView;
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
      <section aria-label="Delivery issues" aria-busy={loading} className="grid gap-4 sm:grid-cols-2">
        {[
          {
            key: "FAILED",
            label: "Unsuccessful deliveries",
            description: "Failed attempts awaiting warehouse return.",
            count: result?.failedCount,
            Icon: AlertTriangle,
            iconTone: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
          },
          {
            key: "WAREHOUSE_RETURN",
            label: "Warehouse returns",
            description: "Parcels reported back to the warehouse.",
            count: result?.warehouseReturnCount,
            Icon: Warehouse,
            iconTone: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
          },
        ].map(({ key, label, description, count, Icon, iconTone }) => (
          <button
            key={key}
            type="button"
            aria-pressed={failureView === key}
            onClick={() => {
              setFailureView(key);
              setPage(0);
              setSearch("");
              document.getElementById("deliveries-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`group rounded-2xl border border-solid p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${failureView === key ? "border-violet-400 ring-2 ring-violet-200 dark:ring-violet-900" : "border-slate-200 dark:border-slate-700"} bg-white dark:bg-slate-800`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-300">{label}</span>
              <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${iconTone}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
            </div>
            <p className="mb-0 mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {loading ? "…" : count ?? 0}
            </p>
            <span className="mt-2 flex items-center gap-1 text-xs text-slate-500 group-hover:text-violet-700 dark:text-slate-400 dark:group-hover:text-violet-300">
              {description} <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>
        ))}
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
            {failureView === "FAILED"
              ? "Unsuccessful deliveries"
              : failureView === "WAREHOUSE_RETURN"
                ? "Warehouse returns"
                : "All deliveries"}
          </h2>
          {failureView !== "ALL" && (
            <button
              type="button"
              onClick={() => { setFailureView("ALL"); setPage(0); }}
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
              : failureView !== "ALL"
                ? `No unresolved ${failureView === "FAILED" ? "unsuccessful deliveries" : "warehouse returns"}.`
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
