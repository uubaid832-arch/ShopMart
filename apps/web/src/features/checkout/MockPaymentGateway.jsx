import { useState } from "react";
import { CreditCard, Smartphone, ShieldCheck } from "lucide-react";

const inputStyle =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit] text-slate-800";

const methodNames = {
  card: "Credit / Debit Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
};

export default function MockPaymentGateway({
  method = "card",
  amount,
  formatPrice,
  busy = false,
  locked = false,
  onApprove,
  onCancel,
}) {
  const isCard = method === "card";
  const Icon = isCard ? CreditCard : Smartphone;

  const [values, setValues] = useState({
    cardholderName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    phone: "",
    mpin: "",
  });

  function update(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function fillTestDetails() {
    setValues({
      cardholderName: "Test Account",
      cardNumber: "4242 4242 4242 4242",
      expiry: "12/30",
      cvv: "123",
      phone: "03000000000",
      mpin: "0000",
    });
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;

    const paymentDetails = isCard
      ? {
          method: "CARD",
          cardholderName: values.cardholderName.trim(),
          cardNumber: values.cardNumber.replaceAll(" ", ""),
          expiry: values.expiry,
          cvv: values.cvv,
        }
      : {
          method: method === "jazzcash" ? "JAZZCASH" : "EASYPAISA",
          phone: values.phone,
          mpin: values.mpin,
        };

    onApprove(paymentDetails);
  }

  function field({
    name,
    label,
    placeholder,
    maxLength,
    pattern,
    type = "text",
    inputMode,
  }) {
    return (
      <label className="grid min-w-0 gap-2 text-sm font-semibold">
        {label}
        <input
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete="off"
          value={values[name]}
          onChange={update}
          placeholder={placeholder}
          maxLength={maxLength}
          pattern={pattern}
          required
          className={inputStyle}
        />
      </label>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white">
      <header className="flex items-center gap-3 bg-violet-50 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
          <Icon size={24} aria-hidden="true" />
        </span>

        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            SHOPMART CHECKOUT
          </p>
          <h3 className="mb-0 mt-1 text-lg font-bold">
            {methodNames[method] ?? "Test payment"}
          </h3>
        </div>
      </header>

      <form onSubmit={submit} autoComplete="off" className="grid gap-5 p-5">
        <p className="m-0 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          Test mode — no real money charged. Use fictional test details only.
          This checkout is not connected to a bank or wallet provider.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-500">Order amount</span>
          <strong className="text-2xl text-violet-700">
            {formatPrice(amount)}
          </strong>
        </div>

        <fieldset
          disabled={busy || locked}
          className="m-0 grid min-w-0 gap-4 border-0 p-0"
        >
          <legend className="sr-only">Test payment details</legend>

          <button
            type="button"
            onClick={fillTestDetails}
            className="justify-self-start rounded-lg border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50"
          >
            Fill test details
          </button>

          {isCard ? (
            <>
              {field({
                name: "cardholderName",
                label: "Cardholder name",
                placeholder: "Test Account",
                maxLength: 50,
              })}

              {field({
                name: "cardNumber",
                label: "Test card number",
                placeholder: "4242 4242 4242 4242",
                maxLength: 23,
                pattern: "[0-9 ]{16,23}",
                inputMode: "numeric",
              })}

              <div className="grid grid-cols-2 gap-3">
                {field({
                  name: "expiry",
                  label: "Expiry",
                  placeholder: "12/30",
                  maxLength: 5,
                  pattern: "[0-9]{2}/[0-9]{2}",
                  inputMode: "numeric",
                })}

                {field({
                  name: "cvv",
                  label: "Test CVV",
                  placeholder: "123",
                  maxLength: 3,
                  pattern: "[0-9]{3}",
                  type: "password",
                  inputMode: "numeric",
                })}
              </div>
            </>
          ) : (
            <>
              {field({
                name: "phone",
                label: "Test mobile account",
                placeholder: "03000000000",
                maxLength: 11,
                pattern: "[0-9]{11}",
                inputMode: "numeric",
              })}

              {field({
                name: "mpin",
                label: "Test MPIN",
                placeholder: "0000",
                maxLength: 4,
                pattern: "[0-9]{4}",
                type: "password",
                inputMode: "numeric",
              })}
            </>
          )}
        </fieldset>

        <p className="m-0 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <ShieldCheck size={17} className="shrink-0" aria-hidden="true" />
          Test credentials are not saved with your order.
        </p>

        {locked && !busy && (
          <p role="status" className="m-0 text-sm text-amber-800">
            The previous result is uncertain. Retry confirmation using the same
            request.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
        >
          {busy
            ? "Processing test payment…"
            : locked
              ? "Retry confirmation"
              : "Confirm test payment"}
        </button>

        <button
          type="button"
          disabled={busy || locked}
          onClick={onCancel}
          className="rounded-xl border-0 bg-slate-100 p-3 font-semibold text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-50"
        >
          Back to payment methods
        </button>
      </form>
    </section>
  );
}
