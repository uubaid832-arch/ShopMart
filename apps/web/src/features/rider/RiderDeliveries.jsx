import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import WarehouseControls from "../delivery/WarehouseControls";
import { useSession } from "../auth/useSession";
import {
  getRiderDeliveries,
  completeRiderDelivery,
  reportFailedDelivery,
} from "../../api/riderDeliveries";
import RiderLocationSharing from "../delivery/RiderLocationSharing";

const statuses = [
  ["ALL", "All"],
  ["CONFIRMED", "Assigned"],
  ["DISPATCHED", "Dispatched"],
  ["DELIVERED", "Delivered"],
  ["CANCELLED", "Cancelled"],
  ["RETURNED", "Returned"],
];
const reasons = [
  ["CUSTOMER_REFUSED", "Customer refused the order"],
  ["CUSTOMER_UNAVAILABLE", "Customer unavailable"],
  ["UNREACHABLE", "Customer not answering"],
  ["INCORRECT_ADDRESS", "Incorrect or incomplete address"],
  ["DAMAGED_PACKAGE", "Package damaged"],
  ["OTHER", "Other reason"],
];
const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";
const inputStyle =
  "box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3 font-[inherit]";
const statusLabel = (value) =>
  statuses.find(([id]) => id === value)?.[1] ?? value;
const reasonLabel = (value) =>
  reasons.find(([id]) => id === value)?.[1] ?? value;
const formatPrice = (amount, currency = "PKR") =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
  }).format(Number(amount));

function FailedDeliveryForm({ delivery, onSave, onClose }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const submitted = useRef(null);
  function close() {
    if (!pending.current) onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending.current || !reason) return;
    const cleanNote = note.trim();
    if (reason === "OTHER" && !cleanNote) {
      setError("Please explain the delivery problem.");
      return;
    }
    if (
      !submitted.current ||
      submitted.current.reason !== reason ||
      submitted.current.note !== cleanNote
    ) {
      submitted.current = {
        requestId: crypto.randomUUID(),
        reason,
        note: cleanNote,
      };
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(submitted.current);
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} labelledBy="failed-delivery-title" size="md">
      <div className="p-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="m-0 text-xs font-bold tracking-widest text-amber-700">
              DELIVERY ATTEMPT
            </p>
            <h2
              id="failed-delivery-title"
              className="mb-0 mt-2 text-xl font-bold"
            >
              Unable to deliver
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close delivery report"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl disabled:opacity-50"
          >
            ×
          </button>
        </header>
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          Report the problem to the administrator. Payment stays unpaid. After
          physically returning the parcel, use Warehouse return.
        </p>
        <p className="break-words text-sm font-semibold">
          {delivery.customerName}
        </p>
        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <label className="grid gap-2 text-sm font-semibold">
              Reason
              <select
                required
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError("");
                }}
                className={inputStyle}
              >
                <option value="">Select a reason</option>
                {reasons.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Note {reason === "OTHER" ? "(required)" : "(optional)"}
              <textarea
                rows={3}
                maxLength={500}
                required={reason === "OTHER"}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setError("");
                }}
                placeholder="Briefly explain what happened."
                className={`${inputStyle} resize-y`}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="flex-1 rounded-xl border-0 bg-amber-600 p-3 font-semibold text-white enabled:hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "Submitting…" : "Report unsuccessful attempt"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border-0 bg-slate-100 px-4 py-3 font-semibold text-slate-600"
              >
                Cancel
              </button>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="mb-0 text-sm text-rose-700">
              {error}
            </p>
          )}
        </form>
      </div>
    </Modal>
  );
}

export default function RiderDeliveries() {
  const { session } = useSession();
  const token = session?.accessToken;
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [failureDelivery, setFailureDelivery] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getRiderDeliveries(token, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ token, page, reload, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ token, page, reload, data: null, error: error.message });
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
  const filtered = (data?.items ?? []).filter(
    (delivery) => status === "ALL" || delivery.status === status,
  );
  async function complete(delivery) {
    if (inFlight.current) return;

    const isDemo = delivery.paymentMethod === "DEMO";

    const message = isDemo
      ? "Confirm this order was delivered? This is a demo payment. Do not collect cash."
      : `Confirm delivery and collection of ${formatPrice(
          delivery.total,
          delivery.currency,
        )} in cash?`;

    if (!window.confirm(message)) return;

    inFlight.current = true;
    setSavingId(delivery.id);
    setFeedback("");
    setActionError("");

    try {
      await completeRiderDelivery(token, delivery.id);

      setFeedback(
        isDemo
          ? "Delivery completed. No cash payment was recorded."
          : "Delivery completed and cash payment recorded.",
      );

      setReload((value) => value + 1);
    } catch (failure) {
      setActionError(failure.message);
    } finally {
      inFlight.current = false;
      setSavingId(null);
    }
  }

  async function saveFailure(values) {
    if (inFlight.current || !failureDelivery)
      throw new Error("Please wait for the current request.");
    inFlight.current = true;
    setSavingId(failureDelivery.id);
    setFeedback("");
    setActionError("");
    try {
      await reportFailedDelivery(token, failureDelivery.id, values);
      setFailureDelivery(null);
      setFeedback(
        "Unsuccessful attempt recorded. The administrator and customer have been notified.",
      );
      setReload((value) => value + 1);
    } finally {
      inFlight.current = false;
      setSavingId(null);
    }
  }
  function deliveryButtons(delivery, blocked = false) {
    return (
      <>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={Boolean(savingId) || blocked}
            onClick={() => complete(delivery)}
            className="rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
          >
            {savingId === delivery.id
              ? "Updating…"
              : delivery.paymentMethod === "DEMO"
                ? "Confirm delivered"
                : "Delivered & cash collected"}
          </button>

          <button
            type="button"
            disabled={Boolean(savingId) || blocked}
            onClick={() => setFailureDelivery(delivery)}
            className="rounded-xl border-0 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 enabled:hover:bg-amber-100 disabled:opacity-50"
          >
            Unable to deliver
          </button>
        </div>

        <RiderLocationSharing
          token={token}
          orderId={delivery.id}
          disabled={Boolean(savingId) || blocked}
        />
      </>
    );
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-3xl font-bold">My deliveries</h1>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            Confirm deliveries, report problems and return unsuccessful parcels.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || Boolean(savingId)}
          onClick={() => setReload((value) => value + 1)}
          className={buttonStyle}
        >
          Refresh
        </button>
      </header>
      <label className="grid max-w-xs gap-2 text-sm font-semibold">
        Filter this page
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={inputStyle}
        >
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {feedback && (
        <p
          role="status"
          className="m-0 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {feedback}
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {actionError}
        </p>
      )}
      <section aria-label="Assigned deliveries" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading deliveries…
          </p>
        ) : error ? (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
            No matching deliveries on this page.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {filtered.map((delivery) => {
              const canUpdate =
                delivery.status === "DISPATCHED" &&
                ((delivery.paymentMethod === "COD" &&
                  delivery.paymentStatus === "UNPAID") ||
                  (delivery.paymentMethod === "DEMO" &&
                    delivery.paymentStatus === "DEMO_PAID"));
              return (
                <li
                  key={delivery.id}
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
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                      {statusLabel(delivery.status)}
                    </span>
                  </div>
                  <p className="mb-1 mt-4 break-words text-sm leading-6 text-slate-600">
                    {delivery.address}
                  </p>
                  <a
                    href={`tel:${delivery.phone}`}
                    className="text-sm font-semibold text-violet-700"
                  >
                    {delivery.phone}
                  </a>
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="m-0 text-xs text-slate-500">
                      {delivery.paymentMethod === "DEMO"
                        ? delivery.status === "CANCELLED"
                          ? "Demo payment voided — no cash collection"
                          : "Demo payment — do not collect cash"
                        : `Cash on delivery · ${delivery.paymentStatus}`}
                    </p>
                    <p className="mb-0 mt-1 text-xl font-bold">
                      {formatPrice(delivery.total, delivery.currency)}
                    </p>
                  </div>
                  {delivery.lastAttempt && (
                    <section className="mt-4 rounded-xl bg-amber-50 p-4">
                      <h3 className="m-0 text-sm font-bold text-amber-900">
                        Last unsuccessful attempt
                      </h3>
                      <p className="mb-0 mt-2 text-sm text-amber-800">
                        {reasonLabel(delivery.lastAttempt.reason)}
                      </p>
                      {delivery.lastAttempt.note && (
                        <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm text-amber-800">
                          {delivery.lastAttempt.note}
                        </p>
                      )}
                      <time
                        dateTime={delivery.lastAttempt.createdAt}
                        className="mt-2 block text-xs text-amber-700"
                      >
                        {new Date(
                          delivery.lastAttempt.createdAt,
                        ).toLocaleString("en-PK")}
                      </time>
                    </section>
                  )}
                  {canUpdate && (
                    <div className="mt-4">
                      {delivery.lastAttempt ? (
                        <WarehouseControls
                          key={`${delivery.id}:${reload}`}
                          token={token}
                          role="rider"
                          orderId={delivery.id}
                        >
                          {({ blocked, saving }) =>
                            deliveryButtons(delivery, blocked || saving)
                          }
                        </WarehouseControls>
                      ) : (
                        deliveryButtons(delivery)
                      )}
                    </div>
                  )}
                  {delivery.status === "CONFIRMED" && (
                    <p className="mb-0 mt-3 text-xs text-slate-500">
                      Delivery actions become available after dispatch.
                    </p>
                  )}
                </li>
              );
            })}
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
            disabled={loading || page === 0 || Boolean(savingId)}
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
            disabled={
              loading || page + 1 >= data.totalPages || Boolean(savingId)
            }
            onClick={() => setPage((value) => value + 1)}
            className={buttonStyle}
          >
            Next →
          </button>
        </nav>
      )}
      {failureDelivery && (
        <FailedDeliveryForm
          key={failureDelivery.id}
          delivery={failureDelivery}
          onSave={saveFailure}
          onClose={() => setFailureDelivery(null)}
        />
      )}
    </div>
  );
}
