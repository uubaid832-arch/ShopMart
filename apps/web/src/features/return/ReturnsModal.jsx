import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import {
  getEligibleReturns,
  getReturnRequests,
  submitReturn,
} from "../../api/returns";
import { useLanguage } from "../language/useLanguage";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

const statusLabels = {
  PENDING: ["Pending", "زیرِ التوا"],
  APPROVED: ["Accepted after inspection", "جانچ کے بعد منظور شدہ"],
  REJECTED: ["Rejected", "مسترد"],
  RECEIVED: ["Received - awaiting inspection", "موصول، جانچ باقی ہے"],
  NOT_INITIATED: ["Not initiated", "ابھی شروع نہیں ہوئی"],
  PROCESSING: ["Processing", "کارروائی جاری ہے"],
  REFUNDED: ["Refunded", "رقم واپس کر دی گئی"],
  PARTIALLY_REFUNDED: ["Partially refunded", "جزوی رقم واپس کر دی گئی"],
  FAILED: ["Failed", "ناکام"],
};

function Pagination({ page, totalPages, onChange, disabled }) {
  const { language, direction } = useLanguage();
  const urdu = language === "ur";

  if (totalPages <= 1) return null;

  return (
    <nav
      dir={direction}
      aria-label={urdu ? "صفحات" : "Pagination"}
      className="mt-3 flex items-center justify-between gap-3"
    >
      <button
        type="button"
        disabled={disabled || page === 0}
        onClick={() => onChange(page - 1)}
        className={buttonStyle}
      >
        {urdu ? "→ پچھلا" : "← Previous"}
      </button>

      <span className="text-xs text-slate-500">
        <bdi>
          {page + 1} / {totalPages}
        </bdi>
      </span>

      <button
        type="button"
        disabled={disabled || page + 1 >= totalPages}
        onClick={() => onChange(page + 1)}
        className={buttonStyle}
      >
        {urdu ? "اگلا ←" : "Next →"}
      </button>
    </nav>
  );
}

export default function ReturnsModal({ accessToken, onClose }) {
  const { language, direction } = useLanguage();
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);
  const locale = urdu ? "ur-PK" : "en-PK";

  const [eligiblePage, setEligiblePage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const inFlight = useRef(false);

  function displayStatus(value = "") {
    const key = String(value).trim().toUpperCase().replaceAll(" ", "_");
    const labels = statusLabels[key];

    return labels ? text(...labels) : String(value).replaceAll("_", " ");
  }

  useEffect(() => {
    if (!accessToken) return;

    const controller = new AbortController();

    Promise.all([
      getEligibleReturns(accessToken, eligiblePage, controller.signal),
      getReturnRequests(accessToken, historyPage, controller.signal),
    ])
      .then(([eligible, history]) => {
        if (!controller.signal.aborted) {
          setResult({
            token: accessToken,
            eligiblePage,
            historyPage,
            reload,
            eligible,
            history,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token: accessToken,
            eligiblePage,
            historyPage,
            reload,
            eligible: null,
            history: null,
            error: error.message || "Could not load return information.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, eligiblePage, historyPage, reload]);

  const current =
    result?.token === accessToken &&
    result?.eligiblePage === eligiblePage &&
    result?.historyPage === historyPage &&
    result?.reload === reload;

  const loading = Boolean(accessToken) && !current;
  const eligible = current ? result.eligible : null;
  const history = current ? result.history : null;

  const error = !accessToken
    ? text(
        "Please sign in to manage your returns.",
        "واپسی کی درخواستیں دیکھنے یا جمع کرنے کے لیے سائن اِن کریں۔",
      )
    : current && result.error
      ? text(
          result.error,
          "واپسی کی معلومات لوڈ نہیں ہو سکیں۔ دوبارہ کوشش کریں یا دوبارہ سائن اِن کریں۔",
        )
      : "";

  function close() {
    if (!inFlight.current) onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    const item = eligible?.items.find((entry) => entry.orderItemId === itemId);

    if (!item || !reason.trim()) {
      setSubmitError({ type: "validation" });
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setFeedback("");

    try {
      await submitReturn(accessToken, {
        orderId: item.orderId,
        orderItemId: item.orderItemId,
        reason: reason.trim(),
      });

      setItemId("");
      setReason("");
      setEligiblePage(0);
      setHistoryPage(0);
      setReload((current) => current + 1);
      setFeedback("submitted");
    } catch (failure) {
      setSubmitError({
        type: "request",
        message: failure.message || "Could not submit your return request.",
      });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const submitErrorText = !submitError
    ? ""
    : submitError.type === "validation"
      ? text(
          "Select an item and enter your reason.",
          "مصنوع منتخب کریں اور واپسی کی وجہ درج کریں۔",
        )
      : text(
          submitError.message,
          "واپسی کی درخواست جمع نہیں ہو سکی۔ ریفریش کرکے اہلیت چیک کریں یا دوبارہ سائن اِن کریں۔",
        );

  return (
    <Modal onClose={close} labelledBy="returns-title" size="lg" fixedSections>
      <header
        dir={direction}
        className="flex shrink-0 items-center justify-between gap-4 bg-violet-50 p-5"
      >
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            {text("AFTER YOUR PURCHASE", "خریداری کے بعد")}
          </p>

          <h2 id="returns-title" className="mb-0 mt-2 text-2xl font-bold">
            {text("Returns & refunds", "واپسی اور رقم کی واپسی")}
          </h2>
        </div>

        <button
          type="button"
          aria-label={text("Close returns", "واپسی کی ونڈو بند کریں")}
          disabled={submitting}
          onClick={close}
          className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-white text-2xl text-slate-600 disabled:opacity-50"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div
        dir={direction}
        className="min-h-0 overflow-y-auto overscroll-contain p-5"
        aria-busy={loading}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="m-0 text-xs leading-5 text-slate-500">
            {text(
              "Returns cover the full quantity of a purchased product line.",
              "واپسی کی درخواست میں منتخب آرڈر آئٹم کی خریدی گئی پوری مقدار شامل ہوتی ہے۔",
            )}
          </p>

          <button
            type="button"
            disabled={loading || submitting || !accessToken}
            onClick={() => setReload((current) => current + 1)}
            className={`${buttonStyle} shrink-0`}
          >
            {text("Refresh", "ریفریش")}
          </button>
        </div>

        <p role="status" className="text-sm text-violet-700 empty:hidden">
          {feedback === "submitted"
            ? text(
                "Return request submitted.",
                "واپسی کی درخواست جمع ہو گئی ہے۔",
              )
            : ""}
        </p>

        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            {text(
              "Loading return information…",
              "واپسی کی معلومات لوڈ ہو رہی ہیں…",
            )}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : eligible && history ? (
          <>
            <section>
              <h3 className="m-0 text-lg font-bold">
                {text("Request a return", "واپسی کی درخواست دیں")}
              </h3>

              {eligible.items.length ? (
                <form onSubmit={handleSubmit} className="mt-4">
                  <fieldset
                    disabled={submitting}
                    className="m-0 grid min-w-0 gap-4 border-0 p-0"
                  >
                    <label className="grid gap-2 text-sm font-semibold">
                      {text("Purchased product", "خریدی گئی مصنوع")}
                      <select
                        required
                        value={itemId}
                        onChange={(event) => {
                          setItemId(event.target.value);
                          setSubmitError(null);
                        }}
                        className="box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-white p-3"
                      >
                        <option value="">
                          {text("Select a product", "مصنوع منتخب کریں")}
                        </option>

                        {eligible.items.map((item) => (
                          <option
                            key={item.orderItemId}
                            value={item.orderItemId}
                          >
                            {item.productName} × {item.quantity} ·{" "}
                            {new Date(item.createdAt).toLocaleDateString(
                              locale,
                            )}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm font-semibold">
                      {text("Reason for return", "واپسی کی وجہ")}
                      <textarea
                        required
                        dir="auto"
                        rows={3}
                        maxLength={1000}
                        value={reason}
                        onChange={(event) => {
                          setReason(event.target.value);
                          setSubmitError(null);
                        }}
                        className="box-border w-full resize-y rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit]"
                      />
                    </label>

                    <button
                      type="submit"
                      className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
                    >
                      {submitting
                        ? text("Submitting…", "درخواست جمع ہو رہی ہے…")
                        : text(
                            "Submit return request",
                            "واپسی کی درخواست جمع کریں",
                          )}
                    </button>
                  </fieldset>
                </form>
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  {text(
                    "No eligible items on this page. Only delivered, paid COD or verified Safepay items without an existing return request are eligible.",
                    "اس صفحے پر کوئی اہل مصنوع موجود نہیں۔ صرف پہنچائی گئی اور ادا شدہ COD یا تصدیق شدہ Safepay مصنوعات اہل ہیں جن کے لیے پہلے واپسی کی درخواست موجود نہ ہو۔",
                  )}
                </p>
              )}

              <p role="alert" className="text-sm text-rose-700 empty:hidden">
                {submitErrorText}
              </p>

              <Pagination
                page={eligiblePage}
                totalPages={eligible.totalPages}
                disabled={submitting}
                onChange={(page) => {
                  setItemId("");
                  setSubmitError(null);
                  setEligiblePage(page);
                }}
              />
            </section>

            <section className="mt-6 border-0 border-t border-solid border-slate-200 pt-5">
              <h3 className="m-0 text-lg font-bold">
                {text("Your requests", "آپ کی درخواستیں")}
              </h3>

              {history.items.length ? (
                <ul className="mb-0 mt-4 grid list-none gap-3 p-0">
                  {history.items.map((request) => (
                    <li
                      key={request.id}
                      className="rounded-2xl border border-solid border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong className="min-w-0 break-words text-sm">
                          <bdi>{request.productName}</bdi> × {request.quantity}
                        </strong>

                        <span className="rounded-full bg-violet-100 px-2 py-1 text-xs capitalize text-violet-700">
                          {displayStatus(request.status)}
                        </span>
                      </div>

                      <p
                        dir="auto"
                        className="whitespace-pre-wrap break-words text-sm text-slate-600"
                      >
                        {request.reason}
                        {request.rejectionReason && <span className="block text-rose-700">Inspection rejection: {request.rejectionReason}. Your product will be shipped back soon.</span>}
                      </p>

                      <p className="text-sm font-semibold">
                        {text("Refund:", "رقم کی واپسی:")}{" "}
                        {displayStatus(request.refundStatus)}
                      </p>

                      <time
                        dateTime={request.createdAt}
                        className="text-xs text-slate-500"
                      >
                        {new Date(request.createdAt).toLocaleDateString(locale)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  {text(
                    "No return requests on this page.",
                    "اس صفحے پر واپسی کی کوئی درخواست موجود نہیں۔",
                  )}
                </p>
              )}

              <Pagination
                page={historyPage}
                totalPages={history.totalPages}
                disabled={submitting}
                onChange={setHistoryPage}
              />
            </section>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
