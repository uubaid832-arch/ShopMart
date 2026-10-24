import { useRef, useState } from "react";
import Modal from "../../components/Modal";

export default function CategoryForm({ category, onSave, onClose }) {
  const [name, setName] = useState(category?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  function close() {
    if (!inFlight.current) onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    const value = name.trim();

    if (!value) {
      setError("Please enter a category name.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(value);
      onClose();
    } catch (failure) {
      setError(failure.message || "Could not save the category.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} labelledBy="category-form-title" size="sm">
      <div className="p-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 id="category-form-title" className="m-0 text-xl font-bold">
            {category ? "Edit category" : "Add category"}
          </h2>

          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close category form"
            className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <label className="grid gap-2 text-sm font-semibold">
              Category name
              <input
                name="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                required
                maxLength={80}
                className="box-border w-full rounded-xl border border-solid border-slate-200 bg-slate-50 p-3"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save category"}
            </button>
          </fieldset>

          <p
            role="alert"
            className="mb-0 mt-3 text-sm text-rose-700 empty:hidden"
          >
            {error}
          </p>
        </form>
      </div>
    </Modal>
  );
}
