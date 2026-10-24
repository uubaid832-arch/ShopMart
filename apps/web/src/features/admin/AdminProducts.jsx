import { useState } from "react";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);

const paginationButton =
  "rounded-xl border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";
export default function AdminProducts({
  products = [],
  loading = false,
  error = "",
  onCreate,
  onEdit,
  onDelete,
  deletingId = null,
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const query = search.trim().toLowerCase();

  const filtered = products.filter((product) =>
    `${product.name} ${product.category}`.toLowerCase().includes(query),
  );

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));

  const startIndex = currentPage * pageSize;
  const visibleProducts = filtered.slice(startIndex, startIndex + pageSize);

  const firstItem = totalItems > 0 ? startIndex + 1 : 0;
  const lastItem = startIndex + visibleProducts.length;

  const firstPageButton = Math.max(
    0,
    Math.min(currentPage - 2, totalPages - 5),
  );

  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPageButton + index,
  );

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
          className="rounded-xl border-0 bg-violet-600 px-4 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
        >
          + Add product
        </button>
      </header>

      <label className="grid gap-2 text-sm font-semibold">
        Search products
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Search by name or category"
          className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
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
        ) : totalItems === 0 ? (
          <div className="p-8 text-center">
            <h2 className="m-0 text-lg font-bold">
              {query ? "No matching products" : "No products to display"}
            </h2>
            <p className="mb-0 mt-2 text-sm text-slate-500">
              {query
                ? "Try another name or category."
                : "Add a product to get started."}
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
                {visibleProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-0 border-t border-solid border-slate-100"
                  >
                    <td className="p-4">
                      <p className="m-0 font-semibold">{product.name}</p>
                      <p className="mb-0 mt-1 text-xs text-slate-500">
                        {product.category}
                      </p>

                      {!product.active && (
                        <span className="mt-2 inline-block rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                          Inactive
                        </span>
                      )}
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
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!onEdit || Boolean(deletingId)}
                          onClick={() => onEdit?.(product)}
                          aria-label={`Edit ${product.name}`}
                          className="rounded-lg border-0 bg-violet-50 px-3 py-2 font-semibold text-violet-700 enabled:hover:bg-violet-100 disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={!onDelete || Boolean(deletingId)}
                          onClick={() => onDelete?.(product)}
                          aria-label={`Delete ${product.name}`}
                          className="rounded-lg border-0 bg-rose-50 px-3 py-2 font-semibold text-rose-700 enabled:hover:bg-rose-100 disabled:opacity-50"
                        >
                          {deletingId === product.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-label="Product pagination"
        aria-busy={loading}
        className="grid gap-4 rounded-2xl border border-solid border-slate-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="m-0 text-sm text-slate-500">
            {loading
              ? "Loading products…"
              : error
                ? "Product count unavailable."
                : `Showing ${firstItem}–${lastItem} of ${totalItems} products`}
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-500">
            Products per page
            <select
              value={pageSize}
              disabled={loading || Boolean(error)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              className="rounded-lg border border-solid border-slate-200 bg-white px-3 py-2 text-slate-800 disabled:opacity-50"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav
          aria-label="Product pages"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={loading || Boolean(error) || currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className={paginationButton}
          >
            ← Previous
          </button>

          <div className="flex flex-wrap items-center justify-center gap-1">
            {!loading &&
              !error &&
              pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  aria-label={`Page ${pageNumber + 1}`}
                  aria-current={currentPage === pageNumber ? "page" : undefined}
                  onClick={() => setPage(pageNumber)}
                  className={`grid size-9 place-items-center rounded-lg border-0 text-sm font-semibold ${
                    currentPage === pageNumber
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-violet-100"
                  }`}
                >
                  {pageNumber + 1}
                </button>
              ))}

            {!loading && !error && totalItems === 0 && (
              <span className="text-xs text-slate-500">No products</span>
            )}
          </div>

          <button
            type="button"
            disabled={
              loading || Boolean(error) || currentPage + 1 >= totalPages
            }
            onClick={() => setPage(currentPage + 1)}
            className={paginationButton}
          >
            Next →
          </button>
        </nav>
      </section>
    </div>
  );
}
