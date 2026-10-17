import { useState } from "react";
import { demoProducts } from "../../data/demoProducts";

const categories = [...new Set(demoProducts.map((product) => product.category))]
  .sort()
  .map((name) => ({
    name,
    productCount: demoProducts.filter((product) => product.category === name)
      .length,
  }));

export default function AdminCategories() {
  const [search, setSearch] = useState("");

  const filtered = categories.filter((category) =>
    category.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-3xl font-bold">Categories</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">
          Organize your store’s product catalog.
        </p>
      </header>

      <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sample catalog · Categories are derived from the sample products.
        Category creation and editing are not connected yet.
      </p>

      <label className="grid gap-2 text-sm font-semibold">
        Search categories
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by category name"
          className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
        />
      </label>

      <p role="status" className="m-0 text-sm text-slate-500">
        {filtered.length} categories found
      </p>

      {filtered.length ? (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ name, productCount }) => (
            <li
              key={name}
              className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
            >
              <h2 className="m-0 text-lg font-bold">{name}</h2>
              <p className="mb-0 mt-3 text-sm text-violet-700">
                {productCount} {productCount === 1 ? "product" : "products"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
          No matching categories. Try another search.
        </p>
      )}
    </div>
  );
}
