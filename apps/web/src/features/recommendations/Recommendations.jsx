export default function Recommendations({
  products = [],
  loading = false,
  error = "",
  renderProduct,
}) {
  return (
    <section aria-labelledby="recommendations-title" className="py-8">
      <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
        DISCOVER MORE
      </p>
      <h2 id="recommendations-title" className="mb-5 mt-2 text-3xl font-bold">
        Recommended for you
      </h2>

      <div aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading recommendations…
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-solid border-slate-200 bg-white p-6">
            <p className="m-0 text-sm text-slate-500">
              Personalized recommendations will appear here when available.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <div key={product.id}>{renderProduct(product)}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
