import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/useSession";
import {
  getAdminReturns,
  updateAdminReturnStatus,
  recordCodRefund,
} from "../../api/adminReturns";
import RefundModal from "./RefundModal";

const statusOptions = [
  ["ALL", "All"],
  ["PENDING", "Pending"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
  ["RECEIVED", "Received"],
];

const statusColors = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-rose-50 text-rose-700",
  RECEIVED: "bg-emerald-50 text-emerald-700",
};

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

const readable = (value = "") => value.replaceAll("_", " ").toLowerCase();

const formatPrice = (amount) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
  }).format(Number(amount));

export default function AdminReturns() {
  const { session } = useSession();
  const token = session.accessToken;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const inFlight = useRef(false);
  const [refundRequest, setRefundRequest] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    getAdminReturns(token, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ token, page, reload, data, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            page,
            reload,
            data: null,
            error: error.message,
          });
        }
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

  const filtered = (data?.items ?? []).filter((request) => {
    const matchesSearch =
      `${request.orderNumber} ${request.customerName} ${request.productName}`
        .toLowerCase()
        .includes(query);

    return matchesSearch && (status === "ALL" || request.status === status);
  });

  async function changeStatus(request, next) {
    if (inFlight.current) return;

    const message =
      next === "RECEIVED"
        ? "Confirm the returned goods have physically arrived? This does not refund money or restock products."
        : next === "REJECTED"
          ? "Reject this return request?"
          : "Approve this return request? This does not issue a refund.";

    if (!window.confirm(message)) return;

    inFlight.current = true;
    setSavingId(request.id);
    setFeedback("");
    setActionError("");

    try {
      await updateAdminReturnStatus(token, request.id, next);
      setFeedback("Return request updated.");
      setReload((current) => current + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      inFlight.current = false;
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-3xl font-bold">Returns & refunds</h1>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            Review requests and confirm receipt of returned goods.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || Boolean(savingId)}
          onClick={() => setReload((current) => current + 1)}
          className={buttonStyle}
        >
          Refresh
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <label className="grid gap-2 text-sm font-semibold">
          Search this page
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order, customer or product"
            className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Status on this page
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-solid border-slate-200 bg-white p-3"
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

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

      <section aria-label="Return requests" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading requests…
          </p>
        ) : error ? (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
            No matching return requests on this page.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {filtered.map((request) => (
              <li
                key={request.id}
                className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="m-0 text-lg font-bold">
                      {request.productName} × {request.quantity}
                    </h2>
                    <p className="mb-0 mt-1 text-sm text-slate-500">
                      {request.customerName}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                      statusColors[request.status] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {readable(request.status)}
                  </span>
                </div>

                <p className="break-all text-xs text-slate-400">
                  {request.orderNumber}
                </p>

                <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {request.reason}
                </p>

                <div className="mb-4 flex flex-wrap justify-between gap-3 text-sm">
                  <span>
                    Refund amount:{" "}
                    <strong>{formatPrice(request.refundAmount)}</strong>
                  </span>
                  <span className="capitalize text-slate-500">
                    Refund: {readable(request.refundStatus)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {request.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={Boolean(savingId)}
                        onClick={() => changeStatus(request, "APPROVED")}
                        className="rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Approve return
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(savingId)}
                        onClick={() => changeStatus(request, "REJECTED")}
                        className="rounded-xl border-0 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-50"
                      >
                        Reject return
                      </button>
                    </>
                  )}

                  {request.status === "APPROVED" && (
                    <button
                      type="button"
                      disabled={Boolean(savingId)}
                      onClick={() => changeStatus(request, "RECEIVED")}
                      className="rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Confirm goods received
                    </button>
                  )}
                </div>

                {savingId === request.id && (
                  <p role="status" className="mb-0 text-sm text-violet-700">
                    Updating request…
                  </p>
                )}

                {request.status === "RECEIVED" &&
                  request.refundStatus === "NOT_INITIATED" &&
                  request.paymentMethod === "COD" && (
                    <button
                      type="button"
                      disabled={Boolean(savingId)}
                      onClick={() => setRefundRequest(request)}
                      className="mt-3 rounded-xl border-0 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white enabled:hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Record COD refund
                    </button>
                  )}
                <time
                  dateTime={request.createdAt}
                  className="mt-4 block text-xs text-slate-400"
                >
                  Requested{" "}
                  {new Date(request.createdAt).toLocaleDateString("en-PK")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && data.totalPages > 1 && (
        <nav
          aria-label="Return request pages"
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={page === 0 || Boolean(savingId)}
            onClick={() => setPage((current) => current - 1)}
            className={buttonStyle}
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= data.totalPages || Boolean(savingId)}
            onClick={() => setPage((current) => current + 1)}
            className={buttonStyle}
          >
            Next →
          </button>
        </nav>
      )}
      {refundRequest && (
        <RefundModal
          key={refundRequest.id}
          request={refundRequest}
          onSave={async (reference) => {
            await recordCodRefund(token, refundRequest.id, reference);
            setFeedback("Refund recorded.");
            setReload((current) => current + 1);
          }}
          onClose={() => setRefundRequest(null)}
        />
      )}
    </div>
  );
}
