import { useRef, useState } from "react";
import Modal from "../../components/Modal";

export default function RefundModal({ request, onSave, onClose }) {
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const amount = new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
  }).format(Number(request.refundAmount));

  function close() {
    if (!inFlight.current) onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (inFlight.current) return;

    if (!reference.trim() || !confirmed) {
      setError("Enter a receipt reference and confirm payment.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(reference.trim());
      onClose();
    } catch (failure) {
      setError(failure.message || "Could not record the refund.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} labelledBy="refund-title" size="sm">
      <div className="p-5">
        <header className="flex items-center justify-between gap-3">
          <h2 id="refund-title" className="m-0 text-xl font-bold">
            Record COD refund
          </h2>

          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close refund recording"
            className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <section className="my-5 rounded-2xl bg-violet-50 p-4">
          <p className="m-0 text-sm font-semibold">
            {request.productName} × {request.quantity}
          </p>
          <p className="mb-0 mt-1 text-sm text-slate-500">
            {request.customerName}
          </p>
          <p className="mb-0 mt-3 text-3xl font-extrabold text-violet-700">
            {amount}
          </p>
        </section>

        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          This records a refund paid outside ShopMart. It does not transfer
          money. Record it only after the customer has been paid.
        </p>

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <label className="grid gap-2 text-sm font-semibold">
              Payment / receipt reference
              <input
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                  setError("");
                }}
                required
                maxLength={200}
                placeholder="Transfer reference or cash receipt number"
                className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
              />
            </label>

            <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                required
                className="mt-1 size-4 shrink-0 accent-violet-600"
              />
              I confirm that the customer has received {amount}.
            </label>

            <button
              type="submit"
              disabled={!confirmed || !reference.trim()}
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Recording…" : "Record refund"}
            </button>
          </fieldset>

          <p role="alert" className="mb-0 text-sm text-rose-700 empty:hidden">
            {error}
          </p>
        </form>
      </div>
    </Modal>
  );
}
