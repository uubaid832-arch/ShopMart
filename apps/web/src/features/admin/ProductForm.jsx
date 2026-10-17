import { useState } from "react";
import Modal from "../../components/Modal";

const inputStyle =
  "w-full rounded-xl border border-solid border-slate-200 bg-white p-3";

export default function ProductForm({ product, onSave, onClose }) {
  const [values, setValues] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "",
    price: String(product?.price ?? ""),
    stock: String(product?.stock ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const data = {
      name: values.name.trim(),
      category: values.category.trim(),
      price: Number(values.price),
      stock: Number(values.stock),
    };

    if (
      !data.name ||
      !data.category ||
      values.price.trim() === "" ||
      values.stock.trim() === "" ||
      !Number.isFinite(data.price) ||
      data.price <= 0 ||
      !Number.isSafeInteger(data.stock) ||
      data.stock < 0
    ) {
      setError(
        "Enter a name, category, positive price and a whole stock quantity of zero or more.",
      );
      return;
    }

    if (!onSave) {
      setError("Form validated. Product saving is not connected yet.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave(data);
      onClose();
    } catch {
      setError("Could not save the product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      onClose={() => {
        if (!saving) onClose();
      }}
      labelledBy="product-form-title"
      size="md"
    >
      <div className="p-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 id="product-form-title" className="m-0 text-xl font-bold">
            {product ? "Edit product" : "Add product"}
          </h2>

          <button
            type="button"
            aria-label="Close product form"
            disabled={saving}
            onClick={onClose}
            className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 hover:bg-violet-100"
          >
            ×
          </button>
        </header>

        {!onSave && (
          <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            UI preview · Changes will not be saved.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <legend className="sr-only">Product information</legend>

            {[
              { name: "name", label: "Product name", maxLength: 150 },
              { name: "category", label: "Category", maxLength: 80 },
              {
                name: "price",
                label: "Price (PKR)",
                type: "number",
                min: "0.01",
                step: "0.01",
              },
              {
                name: "stock",
                label: "Available stock",
                type: "number",
                min: "0",
                step: "1",
              },
            ].map(({ name, label, type = "text", ...attributes }) => (
              <label key={name} className="grid gap-2 text-sm font-semibold">
                {label}
                <input
                  {...attributes}
                  name={name}
                  type={type}
                  required
                  value={values[name]}
                  onChange={update}
                  className={inputStyle}
                />
              </label>
            ))}

            <button
              type="submit"
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : onSave
                  ? "Save product"
                  : "Validate preview"}
            </button>
          </fieldset>

          <p
            role="status"
            className="mb-0 mt-3 text-sm text-violet-700 empty:hidden"
          >
            {error}
          </p>
        </form>
      </div>
    </Modal>
  );
}
