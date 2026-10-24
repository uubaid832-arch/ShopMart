import { useRef, useState } from "react";
import Modal from "../../components/Modal";

export default function AssignRiderModal({
  delivery,
  riders,
  onSave,
  onClose,
}) {
  const [riderId, setRiderId] = useState(
    riders.some((rider) => rider.id === delivery.riderId)
      ? delivery.riderId
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  function close() {
    if (!inFlight.current) onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current || !riderId) return;

    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(riderId);
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} labelledBy="assign-rider-title" size="sm">
      <div className="p-5">
        <header className="flex items-center justify-between gap-3">
          <h2 id="assign-rider-title" className="m-0 text-xl font-bold">
            {delivery.riderId ? "Change rider" : "Assign rider"}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close rider assignment"
            className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <div className="my-5 rounded-xl bg-violet-50 p-4">
          <p className="m-0 text-sm font-semibold">{delivery.customerName}</p>
          <p className="mb-0 mt-1 break-words text-sm text-slate-500">
            {delivery.address}
          </p>
          <p className="mb-0 mt-2 break-all text-xs text-violet-700">
            {delivery.orderNumber}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <label className="grid gap-2 text-sm font-semibold">
              Delivery rider
              <select
                value={riderId}
                onChange={(event) => {
                  setRiderId(event.target.value);
                  setError("");
                }}
                required
                className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
              >
                <option value="">Select a rider</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name}
                  </option>
                ))}
              </select>
            </label>

            {riders.length === 0 && (
              <p className="m-0 text-sm text-amber-700">
                No enabled rider accounts are available.
              </p>
            )}

            <button
              type="submit"
              disabled={!riderId}
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save assignment"}
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
