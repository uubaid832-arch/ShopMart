import { useState } from "react";
import { useSafepay } from "./useSafepay";
export default function SafepayCheckout({ session, request, onPaid, onBack }) {
  const pay = useSafepay(session, onPaid);
  const [popupError, setPopupError] = useState("");
  async function open() {
    const popup = window.open(
      "about:blank",
      "shopmart_safepay",
      "popup,width=520,height=760",
    );
    if (!popup) {
      setPopupError(
        "Allow pop-ups for ShopMart, then press Open Safepay again.",
      );
      return;
    }
    const value = await pay.resume();
    const url = value?.checkoutUrl;
    if (
      value?.state !== "PENDING" ||
      !url ||
      new URL(url).origin !== "https://sandbox.api.getsafepay.com"
    ) {
      popup.close();
      return;
    }
    popup.location.href = url;
  }
  const button =
    "rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-40";
  return (
    <section className="grid gap-4 rounded-2xl border border-solid border-violet-100 bg-white p-5">
      <h3 className="m-0 text-xl font-bold text-violet-800">
        Safepay card checkout
      </h3>
      <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Sandbox test mode. Use Safepay test cards only. No real money is
        charged.
      </p>
      {!pay.ready ? (
        <p>Loading saved checkout…</p>
      ) : !pay.data ? (
        <button
          type="button"
          disabled={pay.busy}
          onClick={() => pay.start(request)}
          className={button}
        >
          {pay.busy ? "Preparing checkout…" : "Prepare Safepay checkout"}
        </button>
      ) : (
        <>
          <strong className="text-xl">
            PKR{" "}
            {Number(pay.data.total).toLocaleString("en-PK", {
              minimumFractionDigits: 2,
            })}
          </strong>
          <p className="m-0 text-sm text-slate-600">{pay.data.message}</p>
          <p className="m-0 break-all text-xs text-slate-500">
            Checkout reference: {pay.data.id}
          </p>
          {pay.data.state === "PENDING" && (
            <>
              <button
                type="button"
                disabled={pay.busy}
                onClick={open}
                className={button}
              >
                Open Safepay secure checkout
              </button>
              <p className="m-0 text-sm text-slate-500">
                Complete payment in the checkout window, then return here.
                ShopMart checks the payment with Safepay automatically.
              </p>
            </>
          )}
          {["PENDING", "REVIEW"].includes(pay.data.state) && (
            <button
              type="button"
              disabled={pay.busy}
              onClick={pay.check}
              className={button}
            >
              {pay.busy ? "Checking payment…" : "Check payment"}
            </button>
          )}
          {["CANCELLED", "REFUNDED"].includes(pay.data.state) && (
            <button
              type="button"
              onClick={async () => {
                await pay.reset();
                onBack();
              }}
              className={button}
            >
              Return to checkout
            </button>
          )}
        </>
      )}
      {(pay.error || popupError) && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
        >
          {pay.error || popupError}
        </p>
      )}
      <button
        type="button"
        disabled={pay.busy}
        onClick={() =>
          onBack(
            Boolean(
              pay.id && !["CANCELLED", "REFUNDED"].includes(pay.data?.state),
            ),
          )
        }
        className="rounded-xl border-0 bg-slate-100 p-3 font-semibold text-slate-600"
      >
        Back
      </button>
    </section>
  );
}
