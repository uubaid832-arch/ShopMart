import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import { placeCodOrder, processMockPayment } from "../../api/orders";
import MockPaymentGateway from "./MockPaymentGateway";
import { getAddresses } from "../../api/addresses";
import { useLanguage } from "../language/useLanguage";

const fields = [
  {
    name: "name",
    label: ["Full name", "پورا نام"],
    autoComplete: "name",
    maxLength: 150,
  },
  {
    name: "email",
    label: ["Email address", "ای میل"],
    type: "email",
    autoComplete: "email",
    maxLength: 254,
  },
  {
    name: "phone",
    label: ["Phone number", "فون نمبر"],
    type: "tel",
    autoComplete: "tel",
    maxLength: 32,
  },
  {
    name: "address",
    label: ["Delivery address", "ڈیلیوری کا پتہ"],
    autoComplete: "street-address",
    maxLength: 500,
  },
  {
    name: "city",
    label: ["City", "شہر"],
    autoComplete: "address-level2",
    maxLength: 150,
  },
];
const paymentMethods = [
  { id: "cod", label: ["Cash on Delivery", "وصولی پر نقد ادائیگی"] },
  { id: "card", label: ["Card — Demo payment", "کارڈ — ڈیمو ادائیگی"] },
  {
    id: "jazzcash",
    label: ["JazzCash — Demo payment", "جاز کیش — ڈیمو ادائیگی"],
  },
  {
    id: "easypaisa",
    label: ["Easypaisa — Demo payment", "ایزی پیسہ — ڈیمو ادائیگی"],
  },
];

const primaryButton =
  "rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50";

const textButton =
  "rounded-lg border-0 bg-transparent px-3 py-2 text-violet-700 enabled:hover:bg-violet-50 disabled:opacity-50";

const inputStyle =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit] text-slate-800 focus:border-violet-500";

function OrderSummary({ items, subtotal, formatPrice }) {
  const { language } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  return (
    <section className="mt-5 rounded-2xl bg-violet-50 p-4">
      <h3 className="m-0 text-base font-bold">
        {text("Order summary", "آرڈر کا خلاصہ")}
      </h3>

      <ul className="my-4 grid list-none gap-3 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 text-sm">
            <span className="min-w-0 break-words">
              <bdi>{item.name}</bdi> × {item.quantity}
            </span>
            <strong className="shrink-0">
              <bdi>{formatPrice(item.price * item.quantity)}</bdi>
            </strong>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-between gap-2 border-0 border-t border-solid border-violet-200 pt-4 font-bold">
        <span>{text("Order total", "آرڈر کی کل رقم")}</span>
        <span>
          <bdi>{formatPrice(subtotal)}</bdi>
        </span>
      </div>

      <p className="mb-0 text-xs text-slate-500">
        {text(
          "Shipping: PKR 0 for this development checkout.",
          "اس موجودہ ترقیاتی COD نظام میں ڈیلیوری چارجز صفر روپے ہیں۔",
        )}
      </p>
    </section>
  );
}

export default function CheckoutModal({ cart, formatPrice, onClose, session }) {
  const { language, direction } = useLanguage();
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);

  const headingRef = useRef(null);
  const requestRef = useRef(null);
  const inFlight = useRef(false);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [addressResult, setAddressResult] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [gatewayOpen, setGatewayOpen] = useState(false);

  const [details, setDetails] = useState({
    name: session?.user.name ?? "",
    email: session?.user.email ?? "",
    phone: session?.user.phone ?? "",
    address: "",
    city: "",
  });

  const accessToken = session?.accessToken;

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!accessToken) return;

    let active = true;

    getAddresses(accessToken)
      .then((items) => {
        if (active) {
          setAddressResult({ token: accessToken, items, error: "" });
        }
      })
      .catch((failure) => {
        if (active) {
          setAddressResult({
            token: accessToken,
            items: [],
            error: failure.message || "Could not load addresses.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  const addressesLoading =
    Boolean(accessToken) && addressResult?.token !== accessToken;

  const addresses =
    accessToken && addressResult?.token === accessToken
      ? addressResult.items
      : [];

  const addressesError =
    accessToken && addressResult?.token === accessToken
      ? addressResult.error
      : "";

  function close() {
    if (inFlight.current) return;

    if (
      locked &&
      !confirmation &&
      !window.confirm(
        text(
          "The order result is uncertain. Closing does not cancel an order that may have been placed. Close anyway?",
          "آرڈر کی تصدیق نہیں ہو سکی۔ ونڈو بند کرنے سے ممکنہ طور پر درج شدہ آرڈر منسوخ نہیں ہوگا۔ کیا آپ پھر بھی بند کرنا چاہتے ہیں؟",
        ),
      )
    ) {
      return;
    }

    onClose();
  }

  function updateDetails(event) {
    const { name, value } = event.target;

    event.target.setCustomValidity("");
    setDetails((current) => ({ ...current, [name]: value }));

    if (name !== "email") setSelectedAddress("");

    setError("");
  }

  function selectAddress(event) {
    const id = event.target.value;
    setSelectedAddress(id);
    setError("");

    const saved = addresses.find((address) => address.id === id);
    if (!saved) return;

    setDetails((current) => ({
      ...current,
      name: saved.recipientName,
      phone: saved.phone,
      address: [saved.addressLine, saved.postalCode].filter(Boolean).join(", "),
      city: saved.city,
    }));

    const form = event.target.form;

    fields.forEach(({ name }) => {
      form.elements.namedItem(name)?.setCustomValidity("");
    });
  }
  async function submitOrder(paymentDetails = null) {
    if (inFlight.current || confirmation) return;

    if (!accessToken || session.expiresAt <= Date.now()) {
      setError("Please close checkout and sign in again.");
      return;
    }

    if (!requestRef.current) {
      if (cart.items.length === 0) {
        setError("Your cart is empty.");
        return;
      }

      requestRef.current = {
        idempotencyKey: crypto.randomUUID(),
        details: Object.fromEntries(
          Object.entries(details).map(([key, value]) => [key, value.trim()]),
        ),
        items: cart.items.map(({ id, quantity }) => ({ id, quantity })),
        paymentMethod,
        paymentDetails,
      };
    }

    inFlight.current = true;
    setSubmitting(true);
    setLocked(true);
    setError("");

    try {
      const request = requestRef.current;

      const placeOrder =
        request.paymentMethod === "cod" ? placeCodOrder : processMockPayment;

      if (request.paymentMethod !== "cod") {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
      const order = await placeOrder({
        ...request,
        accessToken,
      });

      setConfirmation({
        ...order,
        details: request.details,
      });

      setGatewayOpen(false);
      setStep(3);
      cart.clearCart();
    } catch (failure) {
      const rejected = [400, 401, 403, 409, 422].includes(failure.status);

      if (rejected) {
        requestRef.current = null;
        setLocked(false);
      }

      setError(
        rejected
          ? failure.message || "Check your details and cart before retrying."
          : "The order result could not be confirmed. Retry confirmation here with the same details to avoid a duplicate order.",
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (inFlight.current || confirmation) return;

    if (!accessToken || session.expiresAt <= Date.now()) {
      setError("Please close checkout and sign in again.");
      return;
    }

    if (cart.items.length === 0 && !requestRef.current) {
      setError("Your cart is empty.");
      return;
    }

    if (step === 1) {
      const form = event.currentTarget;

      fields.forEach(({ name }) => {
        form.elements
          .namedItem(name)
          .setCustomValidity(
            details[name].trim()
              ? ""
              : text(
                  "Please complete this field.",
                  "براہ کرم یہ خانہ مکمل کریں۔",
                ),
          );
      });

      if (form.reportValidity()) {
        setError("");
        setStep(2);
      }

      return;
    }

    if (paymentMethod !== "cod") {
      setError("");
      setGatewayOpen(true);
      return;
    }

    await submitOrder();
  }

  const title = [
    text("Delivery details", "ڈیلیوری کی تفصیلات"),
    text("Payment & review", "ادائیگی اور جائزہ"),
    text("Order placed", "آرڈر درج ہو گیا"),
  ][step - 1];

  const statusLabels = {
    PENDING: text("Pending", "زیرِ التوا"),
    CONFIRMED: text("Confirmed", "تصدیق شدہ"),
    DISPATCHED: text("Dispatched", "روانہ ہو گیا"),
    DELIVERED: text("Delivered", "پہنچا دیا گیا"),
    CANCELLED: text("Cancelled", "منسوخ"),
    RETURNED: text("Returned", "واپس ہو گیا"),
    UNPAID: text("Unpaid", "غیر ادا شدہ"),
    PAID: text("Paid", "ادا شدہ"),
    PARTIALLY_REFUNDED: text("Partially refunded", "جزوی رقم واپس"),
    REFUNDED: text("Refunded", "رقم واپس"),
    DEMO_PAID: "Demo payment — no money charged",
    DEMO_VOID: "Demo payment voided",
  };

  const displayStatus = (value) =>
    statusLabels[String(value).toUpperCase().replaceAll(" ", "_")] ?? value;

  function deliveryDetails(values) {
    return (
      <>
        <bdi>{values.name}</bdi>
        <br />
        <bdi>
          {values.address}, {values.city}
        </bdi>
        <br />
        <bdi>{values.email}</bdi>
        <br />
        <bdi>{values.phone}</bdi>
      </>
    );
  }

  return (
    <Modal onClose={close} labelledBy="checkout-title" size="lg">
      <header
        dir={direction}
        className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5"
      >
        <h2
          id="checkout-title"
          ref={headingRef}
          tabIndex={-1}
          className="m-0 text-2xl font-bold"
        >
          {title}
        </h2>

        <button
          type="button"
          aria-label={text("Close checkout", "چیک آؤٹ بند کریں")}
          disabled={submitting}
          onClick={close}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div dir={direction} className="p-5">
        {confirmation ? (
          <>
            <p
              role="status"
              className="rounded-xl bg-emerald-50 p-4 text-emerald-800"
            >
              {confirmation.paymentMethod === "DEMO"
                ? "Your demo-payment order has been placed. No money was charged."
                : text(
                    "Your Cash on Delivery order has been placed.",
                    "آپ کا وصولی پر نقد ادائیگی والا آرڈر درج ہو گیا ہے۔",
                  )}
            </p>

            <p className="break-all text-sm font-semibold">
              {text("Order:", "آرڈر:")} <bdi>{confirmation.orderNumber}</bdi>
            </p>

            <p className="text-sm text-slate-600">
              {text("Status:", "حیثیت:")} {displayStatus(confirmation.status)} ·{" "}
              {text("Payment:", "ادائیگی:")}{" "}
              {displayStatus(confirmation.paymentStatus)}
            </p>

            <section className="break-words rounded-xl border border-solid border-slate-200 p-4">
              <h3 className="m-0 text-base font-bold">
                {text("Delivery to", "ڈیلیوری وصول کنندہ")}
              </h3>
              <p className="mb-0 text-sm text-slate-600">
                {deliveryDetails(confirmation.details)}
              </p>
            </section>

            <OrderSummary
              items={confirmation.items.map((item) => ({
                ...item,
                id: item.productId,
                price: Number(item.price),
              }))}
              subtotal={Number(confirmation.total)}
              formatPrice={formatPrice}
            />

            <button
              type="button"
              onClick={close}
              className={`${primaryButton} mt-5 w-full`}
            >
              {text("Continue shopping →", "خریداری جاری رکھیں ←")}
            </button>
          </>
        ) : gatewayOpen ? (
          <div className="grid gap-4">
            <MockPaymentGateway
              method={paymentMethod}
              amount={cart.total}
              formatPrice={formatPrice}
              busy={submitting}
              locked={locked}
              onApprove={submitOrder}
              onCancel={() => {
                if (inFlight.current || locked) return;
                setGatewayOpen(false);
                setError("");
              }}
            />

            {error && (
              <p
                role="alert"
                className="m-0 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mt-0 text-sm text-slate-500">
              {text(
                "Choose COD or a demo payment. Final prices and stock are checked by the server.",
                "وصولی پر نقد ادائیگی · حتمی قیمتوں اور اسٹاک کی جانچ سرور کرتا ہے۔",
              )}
            </p>

            <fieldset
              disabled={submitting}
              className="m-0 grid min-w-0 gap-4 border-0 p-0"
            >
              {step === 1 ? (
                <>
                  <section className="rounded-2xl border border-solid border-violet-100 bg-violet-50 p-4">
                    <h3 className="mb-2 mt-0 text-sm font-bold text-violet-800">
                      {text("Saved delivery addresses", "محفوظ ڈیلیوری پتے")}
                    </h3>

                    {addressesLoading ? (
                      <p role="status" className="m-0 text-sm text-slate-500">
                        {text(
                          "Loading your addresses…",
                          "آپ کے پتے لوڈ ہو رہے ہیں…",
                        )}
                      </p>
                    ) : addressesError ? (
                      <p role="status" className="m-0 text-sm text-slate-600">
                        {text(
                          `${addressesError} You can enter delivery details below.`,
                          "محفوظ پتے لوڈ نہیں ہو سکے۔ آپ نیچے ڈیلیوری کی تفصیلات درج کر سکتے ہیں۔",
                        )}
                      </p>
                    ) : addresses.length === 0 ? (
                      <p className="m-0 text-sm text-slate-500">
                        {text(
                          "No saved addresses yet. Enter your delivery details below, or save an address in My Profile.",
                          "ابھی کوئی پتہ محفوظ نہیں۔ نیچے تفصیلات درج کریں یا میری پروفائل میں پتہ محفوظ کریں۔",
                        )}
                      </p>
                    ) : (
                      <>
                        <label className="grid gap-2 text-sm font-semibold">
                          {text("Choose an address", "پتہ منتخب کریں")}
                          <select
                            value={selectedAddress}
                            onChange={selectAddress}
                            className={inputStyle}
                          >
                            <option value="">
                              {text(
                                "Enter or edit details manually",
                                "تفصیلات خود درج یا تبدیل کریں",
                              )}
                            </option>

                            {addresses.map((address) => (
                              <option key={address.id} value={address.id}>
                                {address.label}
                                {address.isDefault
                                  ? text(" · Default", " · بنیادی")
                                  : ""}
                                {" · "}
                                {address.city}
                              </option>
                            ))}
                          </select>
                        </label>

                        <p className="mb-0 mt-2 text-xs text-slate-500">
                          {text(
                            "Selecting an address fills the fields below. Changes here apply only to this order.",
                            "پتہ منتخب کرنے سے نیچے خانے بھر جائیں گے۔ یہاں کی تبدیلیاں صرف اسی آرڈر پر لاگو ہوں گی۔",
                          )}
                        </p>
                      </>
                    )}
                  </section>

                  {fields.map(
                    ({ name, label, type, autoComplete, maxLength }) => (
                      <label
                        key={name}
                        className="grid gap-2 text-sm font-semibold"
                      >
                        {text(...label)}
                        <input
                          name={name}
                          type={type ?? "text"}
                          dir={
                            ["email", "phone"].includes(name) ? "ltr" : "auto"
                          }
                          autoComplete={autoComplete}
                          value={details[name]}
                          onChange={updateDetails}
                          required
                          maxLength={maxLength}
                          className={inputStyle}
                        />
                      </label>
                    ),
                  )}
                </>
              ) : (
                <>
                  <section className="break-words rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    <h3 className="m-0 text-base font-bold text-slate-800">
                      {text("Delivery to", "ڈیلیوری وصول کنندہ")}
                    </h3>
                    <p className="mb-0">{deliveryDetails(details)}</p>
                  </section>

                  <fieldset className="m-0 grid gap-2 border-0 p-0">
                    <legend className="mb-3 font-semibold">
                      {text("Payment method", "ادائیگی کا طریقہ")}
                    </legend>
                    {paymentMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center gap-3 rounded-xl border border-solid p-3 text-sm ${
                          paymentMethod === method.id
                            ? "border-violet-300 bg-violet-50"
                            : "border-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={paymentMethod === method.id}
                          disabled={locked}
                          onChange={() => {
                            setPaymentMethod(method.id);
                            setError("");
                          }}
                          className="accent-violet-600"
                        />
                        {text(...method.label)}
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

              <div className="mt-2 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setError("");
                    if (step === 1) close();
                    else setStep(1);
                  }}
                  className={textButton}
                >
                  {step === 1
                    ? text("← Continue shopping", "→ خریداری جاری رکھیں")
                    : text("← Edit details", "→ تفصیلات تبدیل کریں")}
                </button>

                <button
                  type="submit"
                  disabled={
                    !accessToken || (cart.items.length === 0 && !locked)
                  }
                  className={primaryButton}
                >
                  {submitting
                    ? text("Placing order…", "آرڈر درج ہو رہا ہے…")
                    : step === 1
                      ? text("Continue to payment →", "ادائیگی کی طرف جائیں ←")
                      : locked
                        ? text("Retry confirmation", "دوبارہ تصدیق کریں")
                        : paymentMethod === "cod"
                          ? text("Place COD order", "COD آرڈر درج کریں")
                          : "Open demo gateway"}
                </button>
              </div>
            </fieldset>

            <p
              role="alert"
              className="mb-0 mt-4 text-sm text-rose-700 empty:hidden"
            >
              {error}
            </p>
          </form>
        )}
      </div>
    </Modal>
  );
}
