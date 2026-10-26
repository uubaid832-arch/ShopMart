import Modal from "../../components/Modal";
import { useLanguage } from "../language/useLanguage";
import InvoiceDownload from "../../components/InvoiceDownload";

const statusColors = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  DISPATCHED: "bg-violet-50 text-violet-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
  RETURNED: "bg-slate-100 text-slate-600",
};

const labels = {
  PENDING: ["Pending", "زیرِ التوا"],
  CONFIRMED: ["Confirmed", "تصدیق شدہ"],
  DISPATCHED: ["Dispatched", "روانہ ہو گیا"],
  DELIVERED: ["Delivered", "پہنچا دیا گیا"],
  CANCELLED: ["Cancelled", "منسوخ"],
  RETURNED: ["Returned", "واپس ہو گیا"],
  UNPAID: ["Unpaid", "غیر ادا شدہ"],
  PAID: ["Paid", "ادا شدہ"],
  PARTIALLY_REFUNDED: ["Partially refunded", "جزوی رقم واپس"],
  REFUNDED: ["Refunded", "رقم واپس"],
  COD: ["Cash on delivery", "وصولی پر نقد ادائیگی"],
};

function normalize(value = "") {
  return String(value).trim().toUpperCase().replaceAll(" ", "_");
}

export default function OrdersModal({
  orders = [],
  loading = false,
  error = "",
  formatPrice,
  onClose,
  footer,
}) {
  const { language, direction } = useLanguage();
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);
  const locale = urdu ? "ur-PK" : "en-PK";

  function displayLabel(value = "") {
    const key = normalize(value);
    const translation = labels[key];

    return translation
      ? text(...translation)
      : String(value).replaceAll("_", " ");
  }

  return (
    <Modal onClose={onClose} labelledBy="orders-title" size="lg" fixedSections>
      <header
        dir={direction}
        className="flex shrink-0 items-center justify-between gap-4 border-0 border-b border-solid border-slate-100 bg-violet-50 p-6"
      >
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            {text("YOUR PURCHASES", "آپ کی خریداری")}
          </p>

          <h2
            id="orders-title"
            className="mb-1 mt-2 text-2xl font-extrabold text-slate-900"
          >
            {text("My orders", "میرے آرڈرز")}
          </h2>

          <p className="m-0 text-sm text-slate-500">
            {text(
              "All your favourite finds, in one place.",
              "آپ کی تمام خریداری کی تفصیلات ایک جگہ۔",
            )}
          </p>
        </div>

        <button
          type="button"
          aria-label={text("Close orders", "آرڈرز بند کریں")}
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-white text-2xl text-slate-500 transition hover:bg-violet-100 hover:text-violet-700"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div
        dir={direction}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-6"
        aria-busy={loading}
      >
        {loading ? (
          <p role="status" className="py-10 text-center text-slate-500">
            {text("Loading your orders…", "آپ کے آرڈرز لوڈ ہو رہے ہیں…")}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="m-0 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : orders.length === 0 ? (
          <div className="py-10 text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid size-20 place-items-center rounded-3xl bg-violet-100 text-4xl text-violet-600"
            >
              ▤
            </span>

            <h3 className="mb-2 mt-5 text-xl font-bold">
              {text(
                "Your next favourite awaits",
                "اپنی پسند کی مصنوعات تلاش کریں",
              )}
            </h3>

            <p className="mb-6 mt-0 text-sm text-slate-500">
              {text(
                "Once you place an order, you’ll find it here.",
                "آرڈر درج کرنے کے بعد اس کی تفصیلات یہاں نظر آئیں گی۔",
              )}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
            >
              {text("Explore products →", "مصنوعات دیکھیں ←")}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white shadow-sm"
              >
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        statusColors[normalize(order.status)] ??
                        statusColors.RETURNED
                      }`}
                    >
                      {displayLabel(order.status)}
                    </span>

                    <time
                      dateTime={order.createdAt}
                      className="text-xs text-slate-500"
                    >
                      {new Date(order.createdAt).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-xs text-slate-500">
                        {text("Order reference", "آرڈر نمبر")}
                      </p>

                      <h3 className="mb-0 mt-1 break-all text-xs font-semibold text-slate-700">
                        <bdi>{order.orderNumber ?? order.id}</bdi>
                      </h3>
                    </div>

                    <div>
                      <p className="m-0 text-xs text-slate-500">
                        {text("Total", "کل رقم")}
                      </p>
                      <p className="mb-0 mt-1 text-xl font-extrabold text-violet-700">
                        <bdi>{formatPrice(order.total)}</bdi>
                        {Number(order.discountAmount) > 0 && (
                          <span className="block text-xs font-normal text-emerald-700">
                            Voucher {order.voucherCode}: -
                            {formatPrice(order.discountAmount)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <ul className="mb-0 mt-5 grid list-none gap-3 border-0 border-t border-solid border-slate-100 p-0 pt-4">
                    {order.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-label={text(
                              `Quantity: ${item.quantity}`,
                              `مقدار: ${item.quantity}`,
                            )}
                            className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-xs font-bold text-violet-700"
                          >
                            <bdi>×{item.quantity}</bdi>
                          </span>

                          <span className="break-words font-medium text-slate-700">
                            <bdi>{item.name}</bdi>
                          </span>
                        </div>

                        <span className="shrink-0 font-semibold text-slate-700">
                          <bdi>{formatPrice(item.price * item.quantity)}</bdi>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="px-5 pb-4">
                  <InvoiceDownload orderId={order.id} />
                </div>
                <details className="group border-0 border-t border-solid border-slate-100">
                  <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 px-5 py-3 text-sm font-semibold text-violet-700 [&::-webkit-details-marker]:hidden">
                    {text("Delivery & payment", "ڈیلیوری اور ادائیگی")}
                    <span
                      aria-hidden="true"
                      className="transition-transform group-open:rotate-180"
                    >
                      ⌄
                    </span>
                  </summary>

                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <section>
                      <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">
                        {text("Delivering to", "ڈیلیوری وصول کنندہ")}
                      </h4>

                      <p className="mb-1 mt-2 break-words text-sm font-semibold text-slate-800">
                        <bdi>{order.delivery.name}</bdi>
                      </p>

                      <p className="m-0 break-words text-sm leading-6 text-slate-500">
                        <bdi>
                          {order.delivery.address}, {order.delivery.city}
                        </bdi>
                        <br />
                        <bdi>{order.delivery.phone}</bdi>
                      </p>
                    </section>

                    <section>
                      <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">
                        {text("Payment", "ادائیگی")}
                      </h4>

                      <p className="mb-2 mt-2 text-sm font-semibold text-slate-800">
                        {order.paymentProvider === "SAFEPAY"
                          ? "Safepay · Sandbox"
                          : normalize(order.paymentMethod) ===
                              "CASH_ON_DELIVERY"
                            ? displayLabel("COD")
                            : displayLabel(order.paymentMethod)}
                      </p>

                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-600">
                        {order.paymentProvider === "SAFEPAY" &&
                        normalize(order.paymentStatus) === "DEMO_PAID"
                          ? "Paid via Safepay"
                          : displayLabel(order.paymentStatus)}
                      </span>
                    </section>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </div>

      {footer && (
        <footer
          dir={direction}
          className="flex shrink-0 items-center justify-between gap-3 border-0 border-t border-solid border-slate-100 bg-white p-5"
        >
          {footer}
        </footer>
      )}
    </Modal>
  );
}
