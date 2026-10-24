import Modal from "../../components/Modal";
import ProductThumbnail from "../../components/ProductThumbnail";
import { useLanguage } from "../language/useLanguage";

export default function CartPanel({
  cart,
  formatPrice,
  isOpen,
  onClose,
  onCheckout,
}) {
  const { language, direction } = useLanguage();
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);

  const quantityButton =
    "size-8 rounded-lg border-0 bg-violet-100 text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="cart-title"
      size="md"
      fixedSections
    >
      <header
        dir={direction}
        className="flex shrink-0 items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5"
      >
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            {text("YOUR EVERYDAY FINDS", "آپ کی پسند کی مصنوعات")}
          </p>

          <h2 id="cart-title" className="mb-0 mt-2 text-2xl font-bold">
            {text("Shopping cart", "خریداری کی ٹوکری")}
            <span className="ms-3 rounded-lg bg-violet-100 px-2 py-1 text-sm text-violet-700">
              {cart.count}
            </span>
          </h2>
        </div>

        <button
          type="button"
          aria-label={text("Close cart", "ٹوکری بند کریں")}
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span aria-hidden="true" className="text-2xl">
            ×
          </span>
        </button>
      </header>

      <div
        dir={direction}
        className="min-h-0 overflow-y-auto overscroll-contain px-5"
      >
        {cart.items.length === 0 ? (
          <div className="py-10 text-center">
            <h3 className="m-0 text-xl font-bold">
              {text("Your cart is waiting", "آپ کی ٹوکری خالی ہے")}
            </h3>

            <p className="mb-6 text-slate-500">
              {text(
                "Add something you love from the collection.",
                "اپنی پسند کی مصنوعات ٹوکری میں شامل کریں۔",
              )}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-white hover:bg-violet-700"
            >
              {text("Continue shopping →", "خریداری جاری رکھیں ←")}
            </button>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {cart.items.map((item) => (
              <li
                key={item.id}
                className="border-0 border-b border-solid border-slate-200 py-5 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <ProductThumbnail product={item} />

                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-xs text-slate-500">
                      <bdi>{item.category}</bdi>
                    </p>

                    <h3 className="my-1 break-words text-base font-bold">
                      <bdi>{item.name}</bdi>
                    </h3>

                    <p className="m-0 text-sm text-slate-500">
                      <bdi>{formatPrice(item.price)}</bdi>{" "}
                      {text("each", "فی عدد")}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={text(
                      `Remove ${item.name} from cart`,
                      `${item.name} کو ٹوکری سے ہٹائیں`,
                    )}
                    onClick={() => cart.removeItem(item.id)}
                    className="shrink-0 rounded-lg border-0 bg-rose-50 px-2 py-1 text-sm text-rose-700 hover:bg-rose-100"
                  >
                    {text("Remove", "ہٹائیں")}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 rounded-xl border border-solid border-slate-200 p-1">
                    <button
                      type="button"
                      className={quantityButton}
                      aria-label={text(
                        `Decrease quantity of ${item.name}`,
                        `${item.name} کی مقدار کم کریں`,
                      )}
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        cart.changeQuantity(item.id, item.quantity - 1)
                      }
                    >
                      −
                    </button>

                    <span
                      className="min-w-5 text-center font-semibold"
                      aria-label={text(
                        `Quantity: ${item.quantity}`,
                        `مقدار: ${item.quantity}`,
                      )}
                    >
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      className={quantityButton}
                      aria-label={text(
                        `Increase quantity of ${item.name}`,
                        `${item.name} کی مقدار بڑھائیں`,
                      )}
                      disabled={item.quantity >= item.stock}
                      onClick={() =>
                        cart.changeQuantity(item.id, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>

                  <strong>
                    <bdi>{formatPrice(item.price * item.quantity)}</bdi>
                  </strong>
                </div>

                {item.quantity >= item.stock && (
                  <p className="mb-0 mt-2 text-xs text-amber-700">
                    {text(
                      "Maximum available quantity reached.",
                      "دستیاب مقدار کی حد پوری ہو چکی ہے۔",
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {cart.items.length > 0 && (
        <footer
          dir={direction}
          className="shrink-0 border-0 border-t border-solid border-slate-200 bg-violet-50 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
            <span>{text("Product subtotal", "مصنوعات کی مجموعی قیمت")}</span>

            <strong className="text-xl text-violet-700">
              <bdi>{formatPrice(cart.total)}</bdi>
            </strong>
          </div>

          <p className="mb-4 mt-2 text-xs text-slate-500">
            {text(
              "Shipping and payment will be handled during checkout.",
              "ڈیلیوری اور ادائیگی کی تفصیلات چیک آؤٹ کے دوران دی جائیں گی۔",
            )}
          </p>

          <button
            type="button"
            onClick={onCheckout}
            className="w-full rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white hover:bg-violet-700"
          >
            {text("Proceed to checkout →", "چیک آؤٹ کی طرف جائیں ←")}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl border-0 bg-transparent p-2 text-violet-700 hover:bg-violet-100"
          >
            {text("Continue shopping →", "خریداری جاری رکھیں ←")}
          </button>
        </footer>
      )}
    </Modal>
  );
}
