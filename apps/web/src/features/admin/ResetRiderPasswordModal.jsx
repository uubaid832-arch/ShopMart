import { useRef, useState } from "react";
import Modal from "../../components/Modal";
import { resetRiderPassword } from "../../api/passwords";

const inputStyle =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-slate-800";

export default function ResetRiderPasswordModal({
  rider,
  accessToken,
  onSaved,
  onClose,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  function close() {
    if (!inFlight.current) onClose();
  }

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    const confirmation = String(data.get("confirmation"));

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must not exceed 72 UTF-8 bytes.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      await resetRiderPassword(accessToken, rider.id, password);
    } catch (failure) {
      setError(failure.message || "Could not reset the password.");
      return;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }

    form.reset();
    onSaved();
    onClose();
  }

  return (
    <Modal onClose={close} labelledBy="reset-rider-title" size="sm">
      <div className="grid gap-5 p-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="reset-rider-title" className="m-0 text-xl font-bold">
              Reset rider password
            </h2>

            <p className="mb-0 mt-2 break-words text-sm text-slate-500">
              {rider.name}
              <br />
              {rider.email}
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={close}
            aria-label="Close password reset"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <p className="m-0 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          This replaces the rider’s password and revokes their refresh sessions.
          Existing access tokens may remain valid for up to 15 minutes. Share
          the new password privately with the rider.
        </p>

        <form onSubmit={submit} onChange={() => setError("")}>
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <legend className="sr-only">New rider password</legend>

            <label className="grid gap-2 text-sm font-semibold">
              New password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                className={inputStyle}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Confirm new password
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                className={inputStyle}
              />
            </label>

            <button
              type="submit"
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Resetting…" : "Reset password"}
            </button>
          </fieldset>

          {error && (
            <p role="alert" className="mb-0 text-sm text-rose-700">
              {error}
            </p>
          )}
        </form>
      </div>
    </Modal>
  );
}
