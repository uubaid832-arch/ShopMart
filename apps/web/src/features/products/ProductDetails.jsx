import { useState } from "react";
import Modal from "../../components/Modal";
import ProductReviews from "../reviews/ProductReviews";
import { useLanguage } from "../language/useLanguage";

const colors = {
  lavender: "bg-[#eeebfc] text-[#51478a]",
  peach: "bg-[#fbede5] text-[#925d44]",
  mint: "bg-[#e8f3ee] text-[#375f55]",
  sand: "bg-[#f8f1df] text-[#927131]",
};

function ProductGallery({ product, children }) {
  const { language } = useLanguage();
  const urdu = language === "ur";

  const [selectedId, setSelectedId] = useState(null);
  const [broken, setBroken] = useState([]);

  const images = (product.images ?? []).filter(
    (image) => !broken.includes(image.id),
  );

  const selected = images.find((image) => image.id === selectedId) ?? images[0];

  function failed(id) {
    setBroken((current) => (current.includes(id) ? current : [...current, id]));
  }

  if (!selected) {
    return (
      <div
        className={`grid min-h-56 place-items-center p-8 sm:min-h-80 ${
          colors[product.color] ?? colors.lavender
        }`}
      >
        <div className="w-full max-w-64">{children}</div>
      </div>
    );
  }

  return (
    <section
      aria-label={urdu ? "مصنوع کی تصاویر" : "Product photos"}
      className="flex min-w-0 flex-col justify-center bg-slate-50 p-5 sm:p-6"
    >
      <div className="grid min-h-64 place-items-center overflow-hidden rounded-2xl bg-white">
        <img
          key={selected.id}
          src={selected.url}
          alt={product.name}
          width={640}
          height={640}
          decoding="async"
          onError={() => failed(selected.id)}
          className="h-72 w-full object-contain sm:h-80"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-6 gap-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={
                urdu
                  ? `مصنوع کی تصویر ${index + 1} دیکھیں`
                  : `View product photo ${index + 1}`
              }
              aria-pressed={selected.id === image.id}
              onClick={() => setSelectedId(image.id)}
              className={`overflow-hidden rounded-xl border-2 border-solid bg-white p-1 ${
                selected.id === image.id
                  ? "border-violet-600"
                  : "border-slate-200 hover:border-violet-400"
              }`}
            >
              <img
                src={image.url}
                alt=""
                width={72}
                height={72}
                loading="lazy"
                onError={() => failed(image.id)}
                className="aspect-square w-full object-contain"
              />
            </button>
          ))}
        </div>
      )}

      <p role="status" className="mb-0 mt-3 text-center text-xs text-slate-500">
        {urdu
          ? `تصویر ${images.indexOf(selected) + 1}، کل ${images.length} تصاویر`
          : `Photo ${images.indexOf(selected) + 1} of ${images.length}`}
      </p>
    </section>
  );
}

export default function ProductDetails({
  product,
  quantity = 0,
  formatPrice,
  onAdd,
  onClose,
  children,
}) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  if (!product) return null;

  const outOfStock = product.stock <= 0;
  const atLimit = quantity >= product.stock;

  const facts = [
    [text("Category", "قسم"), product.category],
    [
      text("Availability", "دستیابی"),
      outOfStock
        ? text("Out of stock", "اسٹاک ختم")
        : text("In stock", "اسٹاک میں موجود"),
    ],
    [text("Available quantity", "دستیاب مقدار"), product.stock],
    [text("In your cart", "آپ کی ٹوکری میں"), quantity],
  ];

  return (
    <Modal onClose={onClose} labelledBy="product-details-title" size="xl">
      <div dir={direction} className="relative grid sm:grid-cols-2">
        <button
          type="button"
          aria-label={text(
            "Close product details",
            "مصنوع کی تفصیلات بند کریں",
          )}
          onClick={onClose}
          className="absolute end-3 top-3 z-10 grid size-10 place-items-center rounded-xl border-0 bg-white text-slate-600 shadow-sm hover:bg-violet-100"
        >
          <span aria-hidden="true" className="text-2xl">
            ×
          </span>
        </button>

        <ProductGallery key={product.id} product={product}>
          {children}
        </ProductGallery>

        <div className="min-w-0 p-6 sm:pt-16">
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-violet-600">
            <bdi>{product.category}</bdi>
          </p>

          <h2
            id="product-details-title"
            className="mb-3 mt-2 break-words text-2xl font-bold"
          >
            <bdi>{product.name}</bdi>
          </h2>

          <p className="mb-5 mt-0 text-3xl font-extrabold text-violet-700">
            <bdi>{formatPrice(product.price)}</bdi>
          </p>

          <section className="mb-5">
            <h3 className="mb-2 mt-0 text-sm font-bold">
              {text("About this product", "اس مصنوع کے بارے میں")}
            </h3>

            <p className="m-0 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
              <bdi>
                {product.description?.trim() ||
                  text(
                    "No description has been added yet.",
                    "ابھی کوئی تفصیل شامل نہیں کی گئی۔",
                  )}
              </bdi>
            </p>
          </section>

          <dl className="mb-5 mt-0">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-0 border-b border-solid border-slate-200 py-3 text-sm"
              >
                <dt className="text-slate-500">{label}</dt>
                <dd className="m-0 min-w-0 break-words text-end font-semibold">
                  <bdi>{value}</bdi>
                </dd>
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
              ? text("Out of stock", "اسٹاک ختم")
              : atLimit
                ? text("Stock limit reached", "دستیاب مقدار کی حد پوری")
                : text("＋ Add to cart", "＋ ٹوکری میں شامل کریں")}
          </button>

          <p
            role="status"
            className="mb-0 mt-3 text-center text-xs text-slate-500"
          >
            {quantity > 0
              ? text(
                  `${quantity} in your cart`,
                  `آپ کی ٹوکری میں ${quantity} موجود ہیں`,
                )
              : text(
                  "Add this product to your cart to continue shopping.",
                  "خریداری جاری رکھنے کے لیے اس مصنوع کو ٹوکری میں شامل کریں۔",
                )}
          </p>
        </div>
      </div>

      <ProductReviews key={product.id} productId={product.id} />
    </Modal>
  );
}
