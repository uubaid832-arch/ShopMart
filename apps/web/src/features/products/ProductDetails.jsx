import Modal from "../../components/Modal";
import ProductReviews from "../reviews/ProductReviews";
const colors = {
  lavender: "bg-[#eeebfc] text-[#51478a]",
  peach: "bg-[#fbede5] text-[#925d44]",
  mint: "bg-[#e8f3ee] text-[#375f55]",
  sand: "bg-[#f8f1df] text-[#927131]",
};

export default function ProductDetails({
  product,
  quantity = 0,
  formatPrice,
  onAdd,
  onClose,
  children,
  reviews = [],
  reviewsLoading = false,
  reviewsError = "",
  canReview = false,
  onSubmitReview,
}) {
  if (!product) return null;

  const outOfStock = product.stock <= 0;
  const atLimit = quantity >= product.stock;

  const facts = [
    ["Category", product.category],
    ["Availability", outOfStock ? "Out of stock" : "In stock"],
    ["Available quantity", product.stock],
    ["In your cart", quantity],
  ];

  return (
    <Modal onClose={onClose} labelledBy="product-details-title" size="xl">
      <div className="relative grid sm:grid-cols-2">
        <button
          type="button"
          aria-label="Close product details"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-xl border-0 bg-white text-slate-600 shadow-sm hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>

        <div
          className={`grid min-h-56 place-items-center p-8 sm:min-h-80 ${
            colors[product.color] ?? colors.lavender
          }`}
        >
          <div className="w-full max-w-64">{children}</div>
        </div>

        <div className="p-6 sm:pt-16">
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-violet-600">
            {product.category}
          </p>

          <h2
            id="product-details-title"
            className="mb-3 mt-2 text-2xl font-bold"
          >
            {product.name}
          </h2>

          <p className="mb-5 mt-0 text-3xl font-extrabold text-violet-700">
            {formatPrice(product.price)}
          </p>

          <dl className="mb-5 mt-0">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-0 border-b border-solid border-slate-200 py-3 text-sm"
              >
                <dt className="text-slate-500">{label}</dt>
                <dd className="m-0 text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            disabled={outOfStock || atLimit}
            onClick={() => onAdd(product)}
            className="w-full rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {outOfStock
              ? "Out of stock"
              : atLimit
                ? "Stock limit reached"
                : "＋ Add to cart"}
          </button>

          <p
            role="status"
            className="mb-0 mt-3 text-center text-xs text-slate-500"
          >
            {quantity > 0
              ? `${quantity} in your cart`
              : "Add this product to your cart to continue shopping."}
          </p>
        </div>
      </div>

      <ProductReviews
        key={product.id}
        reviews={reviews}
        loading={reviewsLoading}
        error={reviewsError}
        canReview={canReview}
        onSubmitReview={onSubmitReview}
      />
    </Modal>
  );
}
