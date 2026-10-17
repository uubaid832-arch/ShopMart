import Modal from "../../components/Modal";
export default function CartPanel({
  cart,
  formatPrice,
  isOpen,
  onClose,
  onCheckout,
}) {
  const quantityButton =
    "size-8 rounded-lg border-0 bg-violet-100 text-violet-700 enabled:hover:bg-violet-200";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="cart-title"
      size="md"
      fixedSections
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            YOUR EVERYDAY FINDS
          </p>
          <h2 id="cart-title" className="mb-0 mt-2 text-2xl font-bold">
            Shopping cart
            <span className="ml-3 rounded-lg bg-violet-100 px-2 py-1 text-sm text-violet-700">
              {cart.count}
            </span>
          </h2>
        </div>

        <button
          type="button"
          aria-label="Close cart"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>

      <div className="min-h-0 overflow-y-auto overscroll-contain px-5">
        {cart.items.length === 0 ? (
          <div className="py-10 text-center">
            <h3 className="m-0 text-xl font-bold">Your cart is waiting</h3>
            <p className="mb-6 text-slate-500">
              Add something you love from the collection.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-white hover:bg-violet-700"
            >
              Continue shopping →
            </button>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {cart.items.map((item) => (
              <li
                key={item.id}
                className="border-0 border-b border-solid border-slate-200 py-5 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-xs text-slate-500">
                      {item.category}
                    </p>
                    <h3 className="my-1 break-words text-base font-bold">
                      {item.name}
                    </h3>
                    <p className="m-0 text-sm text-slate-500">
                      {formatPrice(item.price)} each
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remove ${item.name} from cart`}
                    onClick={() => cart.removeItem(item.id)}
                    className="shrink-0 rounded-lg border-0 bg-rose-50 px-2 py-1 text-rose-700 hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 rounded-xl border border-solid border-slate-200 p-1">
                    <button
                      type="button"
                      className={quantityButton}
                      aria-label={`Decrease quantity of ${item.name}`}
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        cart.changeQuantity(item.id, item.quantity - 1)
                      }
                    >
                      −
                    </button>

                    <span
                      className="min-w-5 text-center font-semibold"
                      aria-label={`Quantity: ${item.quantity}`}
                    >
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      className={quantityButton}
                      aria-label={`Increase quantity of ${item.name}`}
                      disabled={item.quantity >= item.stock}
                      onClick={() =>
                        cart.changeQuantity(item.id, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>

                  <strong>{formatPrice(item.price * item.quantity)}</strong>
                </div>

                {item.quantity >= item.stock && (
                  <p className="mb-0 mt-2 text-xs text-amber-700">
                    Maximum available quantity reached.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.items.length > 0 && (
        <footer className="shrink-0 border-0 border-t border-solid border-slate-200 bg-violet-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
            <span>Product subtotal</span>
            <strong className="text-xl text-violet-700">
              {formatPrice(cart.total)}
            </strong>
          </div>

          <p className="mb-4 mt-2 text-xs text-slate-500">
            Shipping and payment will be handled during checkout.
          </p>

          <button
            type="button"
            onClick={onCheckout}
            className="w-full rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white hover:bg-violet-700"
          >
            Proceed to checkout →
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl border-0 bg-transparent p-2 text-violet-700 hover:bg-violet-100"
          >
            Continue shopping →
          </button>
        </footer>
      )}
    </Modal>
  );
}
