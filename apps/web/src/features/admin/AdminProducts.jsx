import { useState } from "react";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);

export default function AdminProducts({
  products = [],
  loading = false,
  error = "",
  onCreate,
  onEdit,
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const filtered = products.filter((product) =>
    `${product.name} ${product.category}`.toLowerCase().includes(query),
  );

  const buttonStyle =
    "rounded-xl border-0 bg-violet-600 px-4 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50";

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold">Products</h1>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            Manage your catalog, prices and available stock.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          disabled={!onCreate || loading}
          className={buttonStyle}
        >
          + Add product
        </button>
      </header>

      <label className="grid gap-2 text-sm font-semibold">
        Search products
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or category"
          className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
        />
      </label>

      <section
        aria-label="Product catalog"
        aria-busy={loading}
        className="overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white"
      >
        {loading ? (
          <p role="status" className="m-0 p-6 text-slate-500">
            Loading products…
          </p>
        ) : error ? (
          <p role="alert" className="m-0 p-6 text-rose-700">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="m-0 text-lg font-bold">
              {query ? "No matching products" : "No products to display"}
            </h2>
            <p className="mb-0 mt-2 text-sm text-slate-500">
              {query
                ? "Try another name or category."
                : "Products will appear when catalog data is connected."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Store product catalog</caption>

              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Product", "Price", "Stock", "Action"].map((label) => (
                    <th key={label} scope="col" className="p-4 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    className="border-0 border-t border-solid border-slate-100"
                  >
                    <td className="p-4">
                      <p className="m-0 font-semibold">{product.name}</p>
                      <p className="mb-0 mt-1 text-xs text-slate-500">
                        {product.category}
                      </p>
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {formatPrice(product.price)}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {product.stock > 0
                        ? `${product.stock} available`
                        : "Out of stock"}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        disabled={!onEdit}
                        onClick={() => onEdit?.(product)}
                        aria-label={`Edit ${product.name}`}
                        className="rounded-lg border-0 bg-violet-50 px-3 py-2 font-semibold text-violet-700 enabled:hover:bg-violet-100 disabled:opacity-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!onCreate && !onEdit && (
        <p className="m-0 text-xs text-slate-500">
          Product creation and editing are not connected yet.
        </p>
      )}
    </div>
  );
}
