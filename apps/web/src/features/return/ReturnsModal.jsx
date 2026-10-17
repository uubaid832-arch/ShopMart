import { useState } from "react";
import Modal from "../../components/Modal";

export default function ReturnsModal({
  eligibleItems = [],
  requests = [],
  loading = false,
  error = "",
  onSubmitReturn,
  onClose,
}) {
  const [itemKey, setItemKey] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!onSubmitReturn || submitting) return;

    const item = eligibleItems.find((entry) => entry.key === itemKey);

    if (!item || !reason.trim()) {
      setFeedback("Select an item and enter your reason.");
      return;
    }

    setSubmitting(true);
    setFeedback("");

    try {
      await onSubmitReturn({
        orderId: item.orderId,
        orderItemId: item.orderItemId,
        reason: reason.trim(),
      });

      setItemKey("");
      setReason("");
      setFeedback("Return request submitted. Check its status below.");
    } catch {
      setFeedback("Could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="returns-title" size="lg">
      <header className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            AFTER YOUR PURCHASE
          </p>
          <h2 id="returns-title" className="mb-0 mt-2 text-2xl font-bold">
            Returns & Refunds
          </h2>
        </div>

        <button
          type="button"
          aria-label="Close returns and refunds"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>

      <div className="p-5" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-slate-500">
            Loading return information…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">
            {error}
          </p>
        ) : (
          <>
            <section aria-labelledby="return-form-title">
              <h3 id="return-form-title" className="m-0 text-lg font-bold">
                Request a return
              </h3>

              {eligibleItems.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No eligible items are available to display.
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="mt-4">
                  <fieldset
                    disabled={submitting}
                    className="m-0 grid min-w-0 gap-4 border-0 p-0"
                  >
                    <label
                      htmlFor="return-item"
                      className="grid gap-2 text-sm font-semibold"
                    >
                      Order item
                      <select
                        id="return-item"
                        required
                        value={itemKey}
                        onChange={(event) => {
                          setItemKey(event.target.value);
                          setFeedback("");
                        }}
                        className="min-w-0 rounded-xl border border-solid border-slate-200 bg-white p-3"
                      >
                        <option value="">Select an item</option>
                        {eligibleItems.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.productName} · Order #{item.orderId}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label
                      htmlFor="return-reason"
                      className="grid gap-2 text-sm font-semibold"
                    >
                      Reason for return
                      <textarea
                        id="return-reason"
                        required
                        rows={3}
                        value={reason}
                        onChange={(event) => {
                          setReason(event.target.value);
                          setFeedback("");
                        }}
                        className="box-border w-full resize-y rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit]"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={!onSubmitReturn || submitting}
                      className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
                    >
                      {submitting ? "Submitting…" : "Submit return request"}
                    </button>
                  </fieldset>

                  {!onSubmitReturn && (
                    <p className="text-xs text-slate-500">
                      Return submission is currently unavailable.
                    </p>
                  )}

                  <p
                    role="status"
                    className="text-sm text-violet-700 empty:hidden"
                  >
                    {feedback}
                  </p>
                </form>
              )}
            </section>

            <section
              aria-labelledby="return-history-title"
              className="mt-6 border-0 border-t border-solid border-slate-200 pt-5"
            >
              <h3 id="return-history-title" className="m-0 text-lg font-bold">
                Your requests
              </h3>

              {requests.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No return or refund requests to display.
                </p>
              ) : (
                <ul className="mb-0 mt-4 grid list-none gap-3 p-0">
                  {requests.map((request) => (
                    <li
                      key={request.id}
                      className="break-words rounded-xl border border-solid border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong>{request.productName}</strong>
                        <span className="rounded-lg bg-violet-100 px-2 py-1 text-xs text-violet-700">
                          {request.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">
                        Request #{request.id} · Order #{request.orderId}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-slate-600">
                        {request.reason}
                      </p>

                      {request.refundStatus && (
                        <p className="text-sm font-semibold">
                          Refund status: {request.refundStatus}
                        </p>
                      )}

                      <time
                        dateTime={request.createdAt}
                        className="text-xs text-slate-500"
                      >
                        {new Date(request.createdAt).toLocaleDateString(
                          "en-PK",
                        )}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
