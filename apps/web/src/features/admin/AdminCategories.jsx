import { useEffect, useRef, useState } from "react";
import { Folder, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { deleteAdminCategory } from "../../api/adminDeletion";
import { useSession } from "../auth/useSession";
import { getCategories } from "../../api/categories";
import { saveAdminCategory } from "../../api/adminCategories";
import CategoryForm from "./CategoryForm";

export default function AdminCategories() {
  const { session } = useSession();
  const token = session.accessToken;

  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const deletionInFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();

    getCategories(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setResult({ reload, items, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ reload, items: [], error: error.message });
        }
      });

    return () => controller.abort();
  }, [reload]);

  const loading = result?.reload !== reload;
  const error = loading ? "" : result.error;
  const categories = loading ? [] : result.items;
  const query = search.trim().toLowerCase();

  const filtered = categories.filter((category) =>
    category.name.toLowerCase().includes(query),
  );

  async function removeCategory(category) {
    if (deletionInFlight.current) return;

    if (
      !window.confirm(
        `Permanently delete "${category.name}"? Categories containing products cannot be deleted.`,
      )
    ) {
      return;
    }

    deletionInFlight.current = true;
    setDeletingId(category.id);
    setFeedback("");
    setActionError("");

    try {
      await deleteAdminCategory(token, category.id);
      setFeedback("Category deleted.");
    } catch (failure) {
      setActionError(failure.message);
    } finally {
      deletionInFlight.current = false;
      setDeletingId(null);
      setReload((current) => current + 1);
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold">Categories</h1>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            Organise your catalog and manage category names.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || Boolean(deletingId)}
            onClick={() => setReload((current) => current + 1)}
            aria-label="Refresh categories"
            className="grid size-11 place-items-center rounded-xl border border-solid border-slate-200 bg-white text-slate-600 disabled:opacity-50"
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setForm({ category: null })}
            disabled={loading || Boolean(deletingId)}
            className="flex items-center gap-2 rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Plus size={18} aria-hidden="true" />
            Add category
          </button>
        </div>
      </header>

      <label className="grid gap-2 text-sm font-semibold">
        Search categories
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by category name"
          className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
        />
      </label>
      {feedback && (
        <p
          role="status"
          className="m-0 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {feedback}
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {actionError}
        </p>
      )}
      <section aria-label="Catalog categories" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading categories…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">
            {error}
          </p>
        ) : (
          <>
            <p className="mb-4 mt-0 text-sm text-slate-500">
              {filtered.length} categories found
            </p>

            {filtered.length ? (
              <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((category) => (
                  <li
                    key={category.id}
                    className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600">
                        <Folder size={21} aria-hidden="true" />
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={Boolean(deletingId)}
                          onClick={() => setForm({ category })}
                          aria-label={`Edit ${category.name}`}
                          className="grid size-9 place-items-center rounded-lg border-0 bg-slate-50 text-slate-500 enabled:hover:bg-violet-50 enabled:hover:text-violet-700 disabled:opacity-50"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          disabled={Boolean(deletingId)}
                          onClick={() => removeCategory(category)}
                          aria-label={
                            deletingId === category.id
                              ? `Deleting ${category.name}`
                              : `Delete ${category.name}`
                          }
                          className="grid size-9 place-items-center rounded-lg border-0 bg-rose-50 text-rose-700 enabled:hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <h2 className="mb-0 mt-4 break-words text-lg font-bold">
                      {category.name}
                    </h2>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
                {categories.length
                  ? "No matching categories."
                  : "No categories have been added."}
              </p>
            )}
          </>
        )}
      </section>

      {form && (
        <CategoryForm
          key={form.category?.id ?? "new-category"}
          category={form.category}
          onSave={async (name) => {
            await saveAdminCategory(token, form.category?.id, name);
            setReload((current) => current + 1);
          }}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
