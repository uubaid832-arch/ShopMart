import Modal from "../../components/Modal";

export default function OrdersModal({
  orders = [],
  loading = false,
  error = "",
  formatPrice,
  onClose,
}) {
  return (
    <Modal onClose={onClose} labelledBy="orders-title" size="lg">
      <header className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            YOUR SHOPMART PURCHASES
          </p>
          <h2 id="orders-title" className="mb-0 mt-2 text-2xl font-bold">
            My Orders
          </h2>
        </div>

        <button
          type="button"
          aria-label="Close orders"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>

      <div className="p-5" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-center text-slate-500">
            Loading your orders…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">
            {error}
          </p>
        ) : orders.length === 0 ? (
          <div className="py-6 text-center">
            <span
              aria-hidden="true"
              className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-100 text-3xl text-violet-600"
            >
              ▤
            </span>

            <h3 className="mb-2 mt-4 text-xl font-bold">
              No orders to display
            </h3>
            <p className="mb-6 mt-0 text-slate-500">
              Your orders will appear here once available.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
            >
              Continue shopping →
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <details
                key={order.id}
                className="rounded-2xl border border-solid border-slate-200 p-4"
              >
                <summary className="cursor-pointer break-words">
                  <strong>Order #{order.id}</strong>
                  <span className="ml-2 inline-block rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700">
                    {order.status}
                  </span>
                </summary>

                <p className="text-xs text-slate-500">
                  {new Date(order.createdAt).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>

                <ul className="my-4 grid list-none gap-3 p-0">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <strong className="shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </strong>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap justify-between gap-2 border-0 border-t border-solid border-slate-200 pt-4 font-bold">
                  <span>Order total</span>
                  <span className="text-violet-700">
                    {formatPrice(order.total)}
                  </span>
                </div>

                <section className="mt-4 break-words rounded-xl bg-slate-50 p-4">
                  <h3 className="m-0 text-sm font-bold">Delivery details</h3>
                  <p className="mb-0 text-sm text-slate-600">
                    {order.delivery.name}
                    <br />
                    {order.delivery.address}, {order.delivery.city}
                    <br />
                    {order.delivery.phone}
                  </p>
                </section>

                <p className="mb-0 text-sm text-slate-500">
                  Payment method: {order.paymentMethod}
                </p>
              </details>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
