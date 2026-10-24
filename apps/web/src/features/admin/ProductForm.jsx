import { useRef, useState } from "react";
import Modal from "../../components/Modal";
import ProductImages from "./ProductImages";

const inputStyle =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-white p-3";

export default function ProductForm({
  product,
  categories = [],
  onSave,
  onClose,
}) {
  const [values, setValues] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    categoryId: product?.categoryId ?? "",
    price: String(product?.price ?? ""),
    stock: String(product?.stock ?? ""),
    active: product?.active ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");

  const inFlight = useRef(false);
  const imagePending = useRef(false);

  function close() {
    if (!inFlight.current && !imagePending.current) onClose();
  }

  function update(event) {
    const { name, value, type, checked } = event.target;

    setValues((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (inFlight.current || imagePending.current || !onSave) return;

    const data = {
      name: values.name.trim(),
      description: values.description.trim(),
      categoryId: values.categoryId,
      price: values.price.trim(),
      stock: Number(values.stock),
      active: values.active,
      version: product?.version ?? 0,
    };

    if (
      !data.name ||
      !categories.some((category) => category.id === data.categoryId) ||
      !data.price ||
      !Number.isFinite(Number(data.price)) ||
      Number(data.price) <= 0 ||
      values.stock.trim() === "" ||
      !Number.isInteger(data.stock) ||
      data.stock < 0 ||
      data.stock > 2147483647
    ) {
      setError("Enter valid product details and select a category.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(data);
      onClose();
    } catch (failure) {
      setError(failure.message || "Could not save the product.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} labelledBy="product-form-title" size="md">
      <div className="p-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 id="product-form-title" className="m-0 text-xl font-bold">
            {product ? "Edit product" : "Add product"}
          </h2>

          <button
            type="button"
            aria-label="Close product form"
            disabled={saving || imageBusy}
            onClick={close}
            className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 enabled:hover:bg-violet-100 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={saving || imageBusy}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <legend className="sr-only">Product information</legend>

            <label className="grid gap-2 text-sm font-semibold">
              Product name
              <input
                name="name"
                value={values.name}
                onChange={update}
                required
                maxLength={150}
                className={inputStyle}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Description
              <textarea
                name="description"
                value={values.description}
                onChange={update}
                rows={4}
                maxLength={4000}
                placeholder="Describe the product and its features."
                className={`${inputStyle} resize-y`}
              />
              <span className="text-xs font-normal text-slate-500">
                {values.description.length} / 4000 characters
              </span>
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Category
              <select
                name="categoryId"
                value={values.categoryId}
                onChange={update}
                required
                className={inputStyle}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Price (PKR)
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  value={values.price}
                  onChange={update}
                  required
                  className={inputStyle}
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                Available stock
                <input
                  name="stock"
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  value={values.stock}
                  onChange={update}
                  required
                  className={inputStyle}
                />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-xl bg-violet-50 p-4">
              <input
                name="active"
                type="checkbox"
                checked={values.active}
                onChange={update}
                className="mt-1 size-4 accent-violet-600"
              />
              <span>
                <span className="block text-sm font-semibold">
                  Active product
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Inactive products are hidden from the storefront.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={!onSave || categories.length === 0}
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save product details"}
            </button>
          </fieldset>

          <p
            role="alert"
            className="mb-0 mt-3 text-sm text-rose-700 empty:hidden"
          >
            {error}
          </p>
        </form>

        {product?.id ? (
          <ProductImages
            productId={product.id}
            disabled={saving}
            onBusyChange={(busy) => {
              imagePending.current = busy;
              setImageBusy(busy);
            }}
          />
        ) : (
          <p className="mb-0 mt-5 rounded-xl bg-violet-50 p-4 text-sm text-slate-600">
            Save this product first, then open Edit to upload its photos.
          </p>
        )}
      </div>
    </Modal>
  );
}
