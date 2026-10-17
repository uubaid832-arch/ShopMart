import Modal from "../../components/Modal";

export default function AdminOrderDetails({ order, onClose }) {
  const formatPrice = (amount) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: order.currency ?? "PKR",
    }).format(amount);

  return (
    <Modal onClose={onClose} labelledBy="admin-order-title" size="lg">
      <div className="p-5">
        <header className="flex items-center justify-between gap-4">
          <h2 id="admin-order-title" className="m-0 text-xl font-bold">
            Order {order.orderNumber ?? order.id}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close order details"
            className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl hover:bg-violet-100"
          >
            ×
          </button>
        </header>

        <dl className="my-5 grid gap-3 text-sm">
          {[
            ["Customer", order.customerName || "Guest customer"],
            ["Order status", order.status],
            ["Payment method", order.paymentMethod],
            ["Payment status", order.paymentStatus],
            ["Delivery address", order.deliveryAddress],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 sm:grid-cols-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className="m-0 break-words font-semibold">
                {value || "Not available"}
              </dd>
            </div>
          ))}
        </dl>

        <section className="rounded-xl bg-slate-50 p-4">
          <h3 className="m-0 text-base font-bold">Purchased items</h3>

          <ul className="my-4 grid list-none gap-3 p-0">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <strong className="shrink-0">
                  {formatPrice(item.unitPrice * item.quantity)}
                </strong>
              </li>
            ))}
          </ul>

          <div className="flex justify-between gap-4 border-0 border-t border-solid border-slate-200 pt-3 font-bold">
            <span>Order total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </section>

        <p className="mb-0 mt-4 text-xs text-slate-500">
          Read-only preview · Order updates are not connected.
        </p>
      </div>
    </Modal>
  );
}
