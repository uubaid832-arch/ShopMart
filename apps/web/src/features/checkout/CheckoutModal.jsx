import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";

const fields = [
  { name: "name", label: "Full name", autoComplete: "name" },
  {
    name: "email",
    label: "Email address",
    type: "email",
    autoComplete: "email",
  },
  {
    name: "phone",
    label: "Phone number",
    type: "tel",
    autoComplete: "tel",
  },
  {
    name: "address",
    label: "Delivery address",
    autoComplete: "street-address",
  },
  { name: "city", label: "City", autoComplete: "address-level2" },
];

const paymentMethods = [
  { id: "cod", name: "Cash on Delivery" },
  { id: "stripe", name: "Credit / Debit Card" },
  { id: "jazzcash", name: "JazzCash" },
  { id: "easypaisa", name: "EasyPaisa" },
];

const primaryButton =
  "rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50";

const textButton =
  "rounded-lg border-0 bg-transparent px-3 py-2 text-violet-700 hover:bg-violet-50";

const inputStyle =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit] text-slate-800 focus:border-violet-500";

function OrderSummary({ items, subtotal, formatPrice }) {
  return (
    <section className="mt-5 rounded-2xl bg-violet-50 p-4">
      <h3 className="m-0 text-base font-bold">Order summary</h3>

      <ul className="my-4 grid list-none gap-3 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 text-sm">
            <span>
              {item.name} × {item.quantity}
            </span>
            <strong className="shrink-0">
              {formatPrice(item.price * item.quantity)}
            </strong>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-between gap-2 border-0 border-t border-solid border-violet-200 pt-4 font-bold">
        <span>Product subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>

      <p className="mb-0 text-xs text-slate-500">
        Shipping options and charges will come from the backend.
      </p>
    </section>
  );
}

export default function CheckoutModal({ cart, formatPrice, onClose }) {
  const headingRef = useRef(null);
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function updateDetails(event) {
    const { name, value } = event.target;
    event.target.setCustomValidity("");
    setDetails((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (cart.items.length === 0) return;

    if (step === 1) {
      const form = event.currentTarget;

      fields.forEach(({ name }) => {
        form.elements
          .namedItem(name)
          .setCustomValidity(
            details[name].trim() ? "" : "Please complete this field.",
          );
      });

      if (form.reportValidity()) setStep(2);
      return;
    }

    setConfirmation({
      details: Object.fromEntries(
        Object.entries(details).map(([key, value]) => [key, value.trim()]),
      ),
      payment: paymentMethods.find((method) => method.id === paymentMethod)
        .name,
      items: cart.items.map((item) => ({ ...item })),
      subtotal: cart.total,
    });
    setStep(3);
  }

  const title = [
    "Delivery details",
    "Payment & review",
    "Confirmation preview",
  ][step - 1];

  return (
    <Modal onClose={onClose} labelledBy="checkout-title" size="lg">
      <header className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            SHOPMART CHECKOUT
          </p>
          <h2
            id="checkout-title"
            ref={headingRef}
            tabIndex={-1}
            className="mb-0 mt-2 text-2xl font-bold"
          >
            {title}
          </h2>
        </div>

        <button
          type="button"
          aria-label="Close checkout"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>

      <ol
        aria-label="Checkout progress"
        className="m-0 flex list-none justify-between gap-2 bg-violet-50 p-4"
      >
        {["Delivery", "Payment", "Preview"].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className="flex items-center gap-2 text-xs sm:text-sm"
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full font-bold ${
                step >= index + 1
                  ? "bg-violet-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="p-5">
        <p className="m-0 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
          Frontend preview · No order is placed and no payment is processed.
        </p>

        {step === 3 && confirmation ? (
          <>
            <div className="py-5 text-center">
              <span
                aria-hidden="true"
                className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700"
              >
                ✓
              </span>
              <h3 className="mb-2 mt-4 text-xl font-bold">
                Your checkout preview is ready
              </h3>
              <p className="m-0 text-sm text-slate-500">
                Real order placement will be connected to the backend.
              </p>
            </div>

            <section className="break-words rounded-xl border border-solid border-slate-200 p-4">
              <h3 className="m-0 text-base font-bold">Delivery to</h3>
              <p className="text-sm text-slate-600">
                {confirmation.details.name}
                <br />
                {confirmation.details.address}, {confirmation.details.city}
                <br />
                {confirmation.details.email}
                <br />
                {confirmation.details.phone}
              </p>
              <p className="mb-0 text-sm">
                <strong>Payment method:</strong> {confirmation.payment}
              </p>
            </section>

            <OrderSummary
              items={confirmation.items}
              subtotal={confirmation.subtotal}
              formatPrice={formatPrice}
            />

            <button
              type="button"
              onClick={onClose}
              className={`${primaryButton} mt-5 w-full`}
            >
              Continue shopping →
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {step === 1 ? (
              <>
                <p className="text-sm text-slate-500">
                  Continue as a guest. Enter your contact information and
                  delivery address.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map(({ name, label, type, autoComplete }) => {
                    const inputProps = {
                      id: `checkout-${name}`,
                      name,
                      autoComplete,
                      value: details[name],
                      onChange: updateDetails,
                      required: true,
                      className: inputStyle,
                    };

                    return (
                      <label
                        key={name}
                        htmlFor={inputProps.id}
                        className={`grid gap-2 text-sm font-semibold ${
                          name === "email" || name === "phone"
                            ? ""
                            : "sm:col-span-2"
                        }`}
                      >
                        {label}
                        {name === "address" ? (
                          <textarea
                            {...inputProps}
                            rows={3}
                            className={`${inputStyle} resize-y`}
                          />
                        ) : (
                          <input {...inputProps} type={type ?? "text"} />
                        )}
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div className="min-w-0 break-words">
                    <h3 className="m-0 text-base font-bold">
                      Delivery address
                    </h3>
                    <p className="mb-0 text-sm text-slate-500">
                      {details.name}
                      <br />
                      {details.address}, {details.city}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={textButton}
                  >
                    Edit
                  </button>
                </div>

                <fieldset className="mx-0 mb-0 mt-5 grid min-w-0 gap-2 border-0 p-0">
                  <legend className="mb-3 p-0 font-semibold">
                    Choose a payment method
                  </legend>

                  {paymentMethods.map((method) => (
                    <label
                      key={method.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border border-solid p-4 text-sm ${
                        paymentMethod === method.id
                          ? "border-violet-500 bg-violet-50"
                          : "border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={(event) =>
                          setPaymentMethod(event.target.value)
                        }
                        className="accent-violet-600"
                      />
                      {method.name}
                    </label>
                  ))}
                </fieldset>

                <OrderSummary
                  items={cart.items}
                  subtotal={cart.total}
                  formatPrice={formatPrice}
                />
              </>
            )}

            {cart.items.length === 0 && (
              <p role="alert" className="text-sm text-rose-700">
                Your cart is empty. Add a product before checking out.
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 border-0 border-t border-solid border-slate-200 pt-5 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => (step === 1 ? onClose() : setStep(1))}
                className={textButton}
              >
                ← {step === 1 ? "Continue shopping" : "Back"}
              </button>

              <button
                type="submit"
                disabled={cart.items.length === 0}
                className={primaryButton}
              >
                {step === 1
                  ? "Continue to payment →"
                  : "Preview confirmation →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
