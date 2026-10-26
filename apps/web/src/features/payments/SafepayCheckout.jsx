import { useEffect, useRef, useState } from "react";
import {
  CreditCard,
  LoaderCircle,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useSafepay } from "./useSafepay";
function showGateway(popup, value) {
  if (!popup || popup.closed) return false;
  if (value?.state !== "PENDING" || !value.checkoutUrl) {
    popup.close();
    return false;
  }
  try {
    const url = new URL(value.checkoutUrl);
    if (url.origin !== "https://sandbox.api.getsafepay.com") {
      popup.close();
      return false;
    }
    popup.location.href = url.href;
    return true;
  } catch {
    popup.close();
    return false;
  }
}
export default function SafepayCheckout({
  session,
  request,
  checkoutWindow,
  onPaid,
  onBack,
}) {
  const pay = useSafepay(session, onPaid);
  const started = useRef(false);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!pay.ready || started.current) return;
    started.current = true;
    async function launch() {
      const value = pay.data ? await pay.resume() : await pay.start(request);
      setOpened(showGateway(checkoutWindow, value));
    }
    launch();
  }, [pay, request, checkoutWindow]);
  async function reopen() {
    const popup = window.open(
      "about:blank",
      "_blank",
      "popup,width=520,height=760",
    );
    if (popup) {
      popup.opener = null;
      popup.document.title = "Safepay";
      popup.document.body.textContent = "Connecting securely to Safepay…";
    }
    setOpening(true);
    try {
      const value = pay.data ? await pay.resume() : await pay.start(request);
      setOpened(showGateway(popup, value));
    } finally {
      setOpening(false);
    }
  }
  const busy = !pay.ready || pay.busy || opening;
  const terminal = ["CANCELLED", "REFUNDED"].includes(pay.data?.state);
  const review = pay.data?.state === "REVIEW";
  const primary =
    "flex items-center justify-center gap-2 rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50";
  return (
    <section className="grid gap-5 rounded-2xl border border-solid border-violet-100 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <CreditCard size={23} />
          </span>
          <div>
            <h3 className="m-0 text-lg font-bold text-slate-900">Safepay</h3>
            <p className="m-0 mt-1 text-xs text-slate-500">
              Secure card payment
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          Sandbox
        </span>
      </div>
      <strong className="text-3xl text-slate-900">
        PKR{" "}
        {Number(pay.data?.total ?? request.expectedTotal).toLocaleString(
          "en-PK",
          { minimumFractionDigits: 2 },
        )}
      </strong>
      <div className="rounded-xl bg-violet-50 p-4">
        <p
          role="status"
          className="m-0 flex items-center gap-2 font-semibold text-violet-900"
        >
          {busy && <LoaderCircle size={18} className="animate-spin" />}
          {review
            ? "Your payment needs review"
            : terminal
              ? "Payment closed"
              : busy
                ? "Connecting securely…"
                : opened
                  ? "Complete payment in Safepay"
                  : "Continue your payment"}
        </p>
        <p className="mb-0 mt-2 text-sm leading-6 text-slate-600">
          {review || terminal
            ? pay.data.message
            : "Your order confirms automatically after payment. Keep this page open."}
        </p>
      </div>
      {pay.error && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
        >
          {pay.error}
        </p>
      )}
      {!review && !terminal && (
        <button
          type="button"
          disabled={busy}
          onClick={reopen}
          className={primary}
        >
          <ExternalLink size={17} />
          {opened ? "Reopen Safepay" : "Continue to Safepay"}
        </button>
      )}
      {terminal ? (
        <button
          type="button"
          className={primary}
          onClick={async () => {
            await pay.reset();
            onBack(false);
          }}
        >
          Return to checkout
        </button>
      ) : (
        pay.data && (
          <button
            type="button"
            disabled={busy}
            onClick={pay.check}
            className="rounded-xl border-0 bg-slate-100 p-3 font-semibold text-slate-600"
          >
            Already paid? Check status
          </button>
        )
      )}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <ShieldCheck size={16} />
        Test mode · No real money is charged
      </div>
      {pay.data?.id && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer">Payment reference</summary>
          <p className="break-all">{pay.data.id}</p>
        </details>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => onBack(Boolean(pay.id && !terminal))}
        className="flex items-center justify-center gap-2 border-0 bg-transparent p-2 text-sm font-semibold text-slate-500"
      >
        <ArrowLeft size={16} />
        Back to checkout
      </button>
    </section>
  );
}
