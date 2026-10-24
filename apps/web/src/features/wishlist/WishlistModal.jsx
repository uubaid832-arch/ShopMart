import Modal from "../../components/Modal";
import ProductThumbnail from "../../components/ProductThumbnail";
import { useLanguage } from "../language/useLanguage";

export default function WishlistModal({
  wishlist,
  products,
  cart,
  formatPrice,
  onAdd,
  onClose,
}) {
  const { language, direction } = useLanguage();
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);
  const items = products.filter((product) => wishlist.hasItem(product.id));

  return (
    <Modal
      onClose={onClose}
      labelledBy="wishlist-title"
      size="md"
      fixedSections
    >
      <header
        dir={direction}
        className="flex shrink-0 items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5"
      >
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            {text("SAVED FOR LATER", "بعد کے لیے محفوظ")}
          </p>

          <h2 id="wishlist-title" className="mb-0 mt-2 text-2xl font-bold">
            {text("Your wishlist", "آپ کی پسندیدہ مصنوعات")}
            <span className="ms-3 rounded-lg bg-violet-100 px-2 py-1 text-sm text-violet-700">
              {items.length}
            </span>
          </h2>
        </div>

        <button
          type="button"
          aria-label={text("Close wishlist", "پسندیدہ مصنوعات بند کریں")}
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
        {items.length === 0 ? (
          <div className="py-10 text-center">
            <span aria-hidden="true" className="text-5xl text-rose-500">
              ♡
            </span>

            <h3 className="mb-2 mt-4 text-xl font-bold">
              {text("Save your favourites", "اپنی پسندیدہ مصنوعات محفوظ کریں")}
            </h3>

            <p className="m-0 text-slate-500">
              {text(
                "Tap a product’s heart to add it here.",
                "کسی مصنوع کو یہاں شامل کرنے کے لیے دل کے نشان پر کلک کریں۔",
              )}
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((product) => {
              const quantity =
                cart.items.find((item) => item.id === product.id)?.quantity ??
                0;
              const outOfStock = product.stock <= 0;
              const atLimit = quantity >= product.stock;

              return (
                <li
                  key={product.id}
                  className="border-0 border-b border-solid border-slate-200 py-5 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <ProductThumbnail product={product} />

                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-xs text-slate-500">
                        <bdi>{product.category}</bdi>
                      </p>

                      <h3 className="my-1 break-words text-base font-bold">
                        <bdi>{product.name}</bdi>
                      </h3>

                      <p className="m-0 font-semibold text-violet-700">
                        <bdi>{formatPrice(product.price)}</bdi>
                      </p>

                      <p
                        className={`mb-0 mt-1 text-xs ${
                          outOfStock ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {outOfStock
                          ? text("Out of stock", "اسٹاک ختم")
                          : text("In stock", "اسٹاک میں موجود")}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label={text(
                        `Remove ${product.name} from wishlist`,
                        `${product.name} کو پسندیدہ مصنوعات سے ہٹائیں`,
                      )}
                      onClick={() => wishlist.toggleItem(product.id)}
                      className="shrink-0 rounded-lg border-0 bg-rose-50 px-2 py-1 text-sm text-rose-700 hover:bg-rose-100"
                    >
                      {text("Remove", "ہٹائیں")}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={outOfStock || atLimit}
                    onClick={() => onAdd(product)}
                    className="mt-4 w-full rounded-xl border-0 bg-violet-100 p-3 font-semibold text-violet-700 transition enabled:hover:bg-violet-600 enabled:hover:text-white disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {outOfStock
                      ? text("Out of stock", "اسٹاک ختم")
                      : atLimit
                        ? text("Stock limit reached", "دستیاب مقدار کی حد پوری")
                        : text("＋ Add to cart", "＋ ٹوکری میں شامل کریں")}
                  </button>

                  {quantity > 0 && (
                    <p
                      role="status"
                      className="mb-0 mt-2 text-xs text-slate-500"
                    >
                      {text(
                        `${quantity} in your cart`,
                        `آپ کی ٹوکری میں ${quantity} موجود ہیں`,
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer
        dir={direction}
        className="shrink-0 border-0 border-t border-solid border-slate-200 p-5"
      >
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white hover:bg-violet-700"
        >
          {text("Continue shopping →", "خریداری جاری رکھیں ←")}
        </button>
      </footer>
    </Modal>
  );
}
