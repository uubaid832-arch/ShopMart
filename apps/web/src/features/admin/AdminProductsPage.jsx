import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/useSession";
import { getCategories } from "../../api/categories";
import { getAdminProducts, saveAdminProduct } from "../../api/adminProducts";
import AdminProducts from "./AdminProducts";
import ProductForm from "./ProductForm";
import { deleteAdminProduct } from "../../api/adminDeletion";

export default function AdminProductsPage() {
  const { session } = useSession();
  const token = session.accessToken;

  const [result, setResult] = useState(null);
  const [form, setForm] = useState(null);
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const deletionInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getAdminProducts(token, controller.signal),
      getCategories(controller.signal),
    ])
      .then(([products, categories]) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            reload,
            products,
            categories,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            reload,
            products: [],
            categories: [],
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, reload]);

  const current = result?.token === token && result?.reload === reload;

  const loading = !current;
  const error = current ? result.error : "";
  const products = current ? result.products : [];
  const categories = current ? result.categories : [];
  async function removeProduct(product) {
    if (deletionInFlight.current) return;

    if (
      !window.confirm(
        `Permanently delete "${product.name}"? This cannot be undone. Products linked to orders cannot be deleted.`,
      )
    ) {
      return;
    }

    deletionInFlight.current = true;
    setDeletingId(product.id);
    setFeedback("");
    setActionError("");

    try {
      await deleteAdminProduct(token, product);
      setFeedback("Product deleted.");
    } catch (failure) {
      setActionError(failure.message);
    } finally {
      deletionInFlight.current = false;
      setDeletingId(null);
      setReload((current) => current + 1);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          disabled={loading || Boolean(deletingId)}
          onClick={() => setReload((current) => current + 1)}
          className="rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 disabled:opacity-50"
        >
          Refresh products
        </button>
      </div>
      {feedback && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {feedback}
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {actionError}
        </p>
      )}
      <AdminProducts
        products={products}
        loading={loading}
        error={error}
        deletingId={deletingId}
        onDelete={loading || error || deletingId ? undefined : removeProduct}
        onCreate={
          loading || error || deletingId || categories.length === 0
            ? undefined
            : () => setForm({ product: null })
        }
        onEdit={
          loading || error || deletingId
            ? undefined
            : (product) => setForm({ product })
        }
      />

      {current && !error && categories.length === 0 && (
        <p className="text-sm text-amber-700">
          Add a category before creating products.
        </p>
      )}

      {form && (
        <ProductForm
          key={form.product?.id ?? "new-product"}
          product={form.product}
          categories={categories}
          onSave={async (values) => {
            await saveAdminProduct(token, form.product?.id, values);
            setReload((current) => current + 1);
          }}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
