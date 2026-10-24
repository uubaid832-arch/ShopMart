import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import {
  getWarehouseState,
  reportWarehouseReturn,
  confirmWarehouseReceipt,
  resolveWarehouseReturn,
} from "../../api/warehouse";

const reasons = {
  CUSTOMER_REFUSED: "Customer refused the order",
  CUSTOMER_UNAVAILABLE: "Customer unavailable",
  UNREACHABLE: "Customer not answering",
  INCORRECT_ADDRESS: "Incorrect or incomplete address",
  DAMAGED_PACKAGE: "Package damaged",
  OTHER: "Other delivery problem",
};
const secondary =
  "rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 enabled:hover:bg-slate-200 disabled:opacity-50";
const primary =
  "rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50";

function returnLabel(state) {
  if (state?.resolution === "RETRY") return "Another delivery arranged";
  if (state?.resolution === "CANCEL") return "Order cancelled after return";
  if (state?.receivedAt) return "Warehouse receipt confirmed";
  if (state?.reportedAt) return "Awaiting warehouse receipt confirmation";
  return "Unsuccessful delivery recorded";
}

export default function WarehouseControls({
  token,
  role,
  orderId,
  riders = [],
  riderId = "",
  onChanged,
  children,
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [selectedRider, setSelectedRider] = useState(riderId ?? "");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    getWarehouseState(token, role, orderId, controller.signal)
      .then((state) => {
        if (!controller.signal.aborted) {
          setResult({ token, role, orderId, reload, state, error: "" });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            role,
            orderId,
            reload,
            state: null,
            error: failure.message,
          });
        }
      });
    return () => controller.abort();
  }, [token, role, orderId, reload]);

  const current =
    result?.token === token &&
    result?.role === role &&
    result?.orderId === orderId &&
    result?.reload === reload;
  const state = current ? result.state : null;
  const loadError = current ? result.error : "";
  const loading = !current;
  const unresolved = Boolean(state?.attemptId && !state.resolvedAt);
  const blocked =
    loading || Boolean(loadError) || Boolean(unresolved && state.reportedAt);

  function close() {
    if (!inFlight.current) setOpen(false);
  }

  async function perform(action) {
    if (inFlight.current || !state?.attemptId) return;
    if (action === "RETRY" && !selectedRider) {
      setError("Select a rider for the next delivery.");
      return;
    }
    const messages = {
      report: "Have you physically returned this parcel to the warehouse?",
      receive:
        "Confirm that the warehouse has physically received this parcel?",
      RETRY:
        "Arrange another delivery with the selected rider? The order will await dispatch.",
      CANCEL:
        "Cancel this order and restore its product stock? Confirm that the goods have been received back.",
    };
    if (!window.confirm(messages[action])) return;
    inFlight.current = true;
    setSaving(action);
    setError("");
    setFeedback("");
    try {
      if (action === "report") {
        await reportWarehouseReturn(token, orderId, state.attemptId);
      } else if (action === "receive") {
        await confirmWarehouseReceipt(token, orderId, state.attemptId);
      } else {
        await resolveWarehouseReturn(token, orderId, {
          attemptId: state.attemptId,
          action,
          riderId: action === "RETRY" ? selectedRider : null,
        });
      }
      if (action === "RETRY" || action === "CANCEL") {
        setOpen(false);
        onChanged?.(
          action === "RETRY"
            ? "Another delivery arranged. Dispatch the order when ready."
            : "Order cancelled and stock restored.",
        );
      } else {
        // Refresh only this panel so the admin can receive, then resolve.
        setReload((value) => value + 1);
        setFeedback(
          action === "report"
            ? "Return reported. Wait for administrator receipt confirmation."
            : "Receipt confirmed. Choose another delivery or cancellation.",
        );
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      inFlight.current = false;
      setSaving("");
    }
  }

  return (
    <div className="grid gap-3">
      {children?.({ blocked, loading, saving: Boolean(saving) })}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={secondary}
        >
          {role === "admin" ? "Resolve warehouse return" : "Warehouse return"}
        </button>
        {state?.attemptId && (
          <span role="status" className="text-xs font-semibold text-amber-800">
            {returnLabel(state)}
          </span>
        )}
      </div>
      {loadError && (
        <p role="alert" className="m-0 text-sm text-rose-700">
          {loadError}
        </p>
      )}

      {open && (
        <Modal
          onClose={close}
          labelledBy={`warehouse-title-${orderId}`}
          size="md"
        >
          <div className="grid gap-5 p-5 sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
                  PARCEL RETURN
                </p>
                <h2
                  id={`warehouse-title-${orderId}`}
                  className="mb-0 mt-2 text-2xl font-bold"
                >
                  {role === "admin"
                    ? "Resolve delivery return"
                    : "Return to warehouse"}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={Boolean(saving)}
                aria-label="Close warehouse return"
                className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl disabled:opacity-50"
              >
                ×
              </button>
            </header>
            {loading ? (
              <p role="status">Loading return status…</p>
            ) : loadError ? (
              <p role="alert" className="text-rose-700">
                {loadError}
              </p>
            ) : !state?.attemptId ? (
              <p className="m-0 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Report an unsuccessful delivery before returning the parcel.
              </p>
            ) : (
              <>
                <section className="rounded-xl bg-amber-50 p-4">
                  <h3 className="m-0 text-base font-bold text-amber-900">
                    {returnLabel(state)}
                  </h3>
                  <p className="mb-0 mt-2 text-sm text-amber-800">
                    {reasons[state.reason] ?? state.reason}
                  </p>
                  {state.note && (
                    <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm text-amber-800">
                      {state.note}
                    </p>
                  )}
                </section>
                <ol className="m-0 grid gap-3 pl-5 text-sm text-slate-600">
                  <li>
                    Rider returns parcel:{" "}
                    {state.reportedAt
                      ? new Date(state.reportedAt).toLocaleString("en-PK")
                      : "Not reported yet"}
                  </li>
                  <li>
                    Admin confirms receipt:{" "}
                    {state.receivedAt
                      ? new Date(state.receivedAt).toLocaleString("en-PK")
                      : "Pending"}
                  </li>
                  <li>
                    Resolution:{" "}
                    {state.resolution === "RETRY"
                      ? "Another delivery arranged"
                      : state.resolution === "CANCEL"
                        ? "Cancelled; stock restored"
                        : "Pending"}
                  </li>
                </ol>
                {role === "rider" && unresolved && !state.reportedAt && (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => perform("report")}
                    className={primary}
                  >
                    {saving ? "Saving…" : "Parcel returned to warehouse"}
                  </button>
                )}
                {role === "rider" && unresolved && state.reportedAt && (
                  <p className="m-0 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                    Delivery actions are paused. Wait for the administrator to
                    resolve this return.
                  </p>
                )}
                {role === "admin" && unresolved && !state.reportedAt && (
                  <p className="m-0 text-sm text-slate-500">
                    The rider must report the parcel returned before warehouse
                    receipt can be confirmed.
                  </p>
                )}
                {role === "admin" &&
                  unresolved &&
                  state.reportedAt &&
                  !state.receivedAt && (
                    <button
                      type="button"
                      disabled={Boolean(saving)}
                      onClick={() => perform("receive")}
                      className={primary}
                    >
                      {saving
                        ? "Saving…"
                        : "Confirm physical warehouse receipt"}
                    </button>
                  )}
                {role === "admin" && unresolved && state.receivedAt && (
                  <section className="grid gap-4 rounded-2xl border border-solid border-violet-200 p-4">
                    <h3 className="m-0 text-base font-bold">Next action</h3>
                    <label className="grid gap-2 text-sm font-semibold">
                      Rider for another delivery
                      <select
                        value={selectedRider}
                        disabled={Boolean(saving)}
                        onChange={(event) =>
                          setSelectedRider(event.target.value)
                        }
                        className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
                      >
                        <option value="">Select rider</option>
                        {riders.map((rider) => (
                          <option key={rider.id} value={rider.id}>
                            {rider.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={Boolean(saving) || !selectedRider}
                      onClick={() => perform("RETRY")}
                      className={primary}
                    >
                      {saving === "RETRY"
                        ? "Arranging…"
                        : "Arrange another delivery"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(saving)}
                      onClick={() => perform("CANCEL")}
                      className="rounded-xl border-0 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 enabled:hover:bg-rose-100 disabled:opacity-50"
                    >
                      {saving === "CANCEL"
                        ? "Cancelling…"
                        : "Cancel order & restore stock"}
                    </button>
                    <p className="m-0 text-xs leading-5 text-slate-500">
                      Correct the customer's delivery details before arranging
                      another delivery. Payment stays unpaid.
                    </p>
                  </section>
                )}
              </>
            )}
            {feedback && (
              <p role="status" className="m-0 text-sm text-emerald-700">
                {feedback}
              </p>
            )}
            {error && (
              <p role="alert" className="m-0 text-sm text-rose-700">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={Boolean(saving) || loading}
              onClick={() => setReload((value) => value + 1)}
              className={secondary}
            >
              Refresh return status
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
