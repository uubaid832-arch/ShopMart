import { useLanguage } from "../language/useLanguage";

export default function Recommendations({
  products = [],
  cartItems = [],
  viewedProductIds = [],
  loading = false,
  error = "",
  renderProduct,
}) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const cartIds = new Set(cartItems.map((item) => item.id));
  const categoryScores = new Map();

  function addCategoryScore(category, score) {
    if (!category) return;

    categoryScores.set(category, (categoryScores.get(category) ?? 0) + score);
  }

  cartItems.forEach((item) => {
    const product = products.find((entry) => entry.id === item.id);
    addCategoryScore(product?.category, 5);
  });

  viewedProductIds.forEach((id, index) => {
    const product = products.find((entry) => entry.id === id);
    addCategoryScore(product?.category, Math.max(1, 3 - index));
  });

  const suggestions = products
    .filter(
      (product) =>
        product.active !== false &&
        product.stock > 0 &&
        !cartIds.has(product.id),
    )
    .map((product, index) => ({
      product,
      index,
      score: categoryScores.get(product.category) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .map(({ product }) => product);

  const personalized = categoryScores.size > 0;

  return (
    <section
      dir={direction}
      aria-labelledby="recommendations-title"
      className="py-8"
    >
      <header className="mb-5">
        <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
          {text("DISCOVER MORE", "مزید دریافت کریں")}
        </p>

        <h2 id="recommendations-title" className="mb-2 mt-2 text-3xl font-bold">
          {personalized
            ? text("Recommended for you", "آپ کے لیے منتخب مصنوعات")
            : text("Explore more products", "مزید مصنوعات دیکھیں")}
        </h2>

        <p className="m-0 text-sm text-slate-500">
          {personalized
            ? text(
                "Suggestions based on the categories you browse and add to your cart.",
                "یہ تجاویز آپ کی دیکھی گئی اور ٹوکری میں شامل کی گئی مصنوعات کی اقسام پر مبنی ہیں۔",
              )
            : text(
                "Browse products to discover suggestions that match your interests.",
                "اپنی دلچسپی کے مطابق تجاویز کے لیے مصنوعات دیکھیں۔",
              )}
        </p>
      </header>

      <div aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            {text(
              "Loading recommendations…",
              "تجویز کردہ مصنوعات لوڈ ہو رہی ہیں…",
            )}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {text(
              error,
              "تجویز کردہ مصنوعات لوڈ نہیں ہو سکیں۔ دوبارہ کوشش کریں۔",
            )}
          </p>
        ) : suggestions.length === 0 ? (
          <div className="rounded-2xl border border-solid border-slate-200 bg-white p-6">
            <p className="m-0 text-sm text-slate-500">
              {text(
                "No additional in-stock products are available right now.",
                "فی الحال مزید دستیاب مصنوعات موجود نہیں ہیں۔",
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map((product) => (
              <div key={product.id} className="min-w-0">
                {renderProduct(product)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
