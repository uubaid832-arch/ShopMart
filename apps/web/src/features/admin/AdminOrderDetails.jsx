import { useRef } from "react";
import { X, Package, MapPin, CreditCard } from "lucide-react";
import Modal from "../../components/Modal";

const stages = ["Pending", "Confirmed", "Dispatched", "Delivered"];

const statusColors = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-blue-100 text-blue-800",
  Dispatched: "bg-violet-100 text-violet-800",
  Delivered: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-rose-100 text-rose-800",
  Returned: "bg-slate-200 text-slate-700",
};

export default function AdminOrderDetails({ order, onClose }) {
  const inFlight = useRef(false);

  const formatPrice = (amount) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: order.currency ?? "PKR",
    }).format(amount);

  const stage = stages.indexOf(order.status);

  function close() {
    if (!inFlight.current) onClose();
  }

  return (
    <Modal
      onClose={close}
      labelledBy="admin-order-title"
      size="xl"
      fixedSections
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-0 border-b border-solid border-violet-100 bg-violet-50 p-5 sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-violet-600">
            <Package size={18} aria-hidden="true" />
            <p className="m-0 text-xs font-bold tracking-widest">
              ORDER DETAILS
            </p>
          </div>

          <h2
            id="admin-order-title"
            className="mb-2 mt-3 text-2xl font-extrabold text-slate-900"
          >
            Customer order
          </h2>

          <p className="m-0 break-all text-xs text-slate-500">
            {order.orderNumber ?? order.id}
          </p>
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Close order details"
          className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-white text-slate-500 enabled:hover:bg-violet-100 disabled:opacity-50"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              statusColors[order.status] ?? statusColors.Returned
            }`}
          >
            {order.status}
          </span>

          {order.createdAt && (
            <time dateTime={order.createdAt} className="text-xs text-slate-500">
              {new Date(order.createdAt).toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
          )}
        </div>

        {stage >= 0 && (
          <ol
            aria-label="Order progress"
            className="mb-5 mt-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4"
          >
            {stages.map((label, index) => (
              <li
                key={label}
                aria-current={index === stage ? "step" : undefined}
                className={`rounded-xl p-3 text-xs font-semibold ${
                  index <= stage
                    ? "bg-violet-100 text-violet-800"
                    : "bg-slate-200/60 text-slate-500"
                }`}
              >
                <span className="mr-2">{index + 1}.</span>
                {label}
              </li>
            ))}
          </ol>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-solid border-slate-200 bg-white p-4">
            <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-slate-800">
              <MapPin
                size={17}
                className="text-violet-600"
                aria-hidden="true"
              />
              Delivery details
            </h3>

            <p className="mb-2 mt-4 break-words text-sm font-semibold">
              {order.customerName || "Not available"}
            </p>
            <p className="m-0 break-words text-sm leading-6 text-slate-500">
              {order.deliveryAddress}
            </p>
            <p className="mb-0 mt-3 text-sm text-slate-600">
              {order.delivery?.phone}
            </p>
            <p className="mb-0 mt-1 break-words text-xs text-slate-500">
              {order.delivery?.email}
            </p>
          </section>

          <section className="rounded-2xl border border-solid border-slate-200 bg-white p-4">
            <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-slate-800">
              <CreditCard
                size={17}
                className="text-violet-600"
                aria-hidden="true"
              />
              Payment summary
            </h3>

            <p className="mb-1 mt-4 text-sm text-slate-500">
              {order.paymentMethod}
            </p>
            <p className="m-0 text-3xl font-extrabold text-violet-700">
              {formatPrice(order.total)}
            </p>

            {Number(order.discountAmount) > 0 && (
              <p className="text-sm font-semibold text-emerald-700">
                Voucher {order.voucherCode}: -
                {formatPrice(order.discountAmount)}
              </p>
            )}
            <span
              className={`mt-3 inline-block rounded-lg px-2 py-1 text-xs font-semibold ${
                order.paymentStatus === "Paid"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {order.paymentStatus}
            </span>
          </section>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white">
          <h3 className="m-0 border-0 border-b border-solid border-slate-100 px-4 py-4 text-sm font-bold">
            Purchased items
            <span className="ml-2 text-slate-400">({order.items.length})</span>
          </h3>

          <ul className="m-0 list-none px-4 py-0">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-100 py-4 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-xs font-bold text-violet-700">
                    ×{item.quantity}
                  </span>

                  <div className="min-w-0">
                    <p className="m-0 break-words text-sm font-semibold">
                      {item.name}
                    </p>
                    <p className="mb-0 mt-1 text-xs text-slate-500">
                      {formatPrice(item.unitPrice)} each
                    </p>
                  </div>
                </div>

                <strong className="shrink-0 text-sm">
                  {formatPrice(item.unitPrice * item.quantity)}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
