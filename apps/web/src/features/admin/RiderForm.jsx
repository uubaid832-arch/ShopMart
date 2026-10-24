import { useRef, useState } from "react";
import Modal from "../../components/Modal";

const inputStyle =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-slate-800";

export default function RiderForm({ onSave, onClose }) {
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

    const values = {
      name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim(),
      phone: String(data.get("phone")).trim(),
      password: String(data.get("password")),
    };

    if (!values.name) {
      setError("Please enter the rider's name.");
      return;
    }

    if (new TextEncoder().encode(values.password).length > 72) {
      setError("Password must not exceed 72 UTF-8 bytes.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(values);
      onClose();
    } catch (failure) {
      setError(failure.message || "Could not create the rider account.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} labelledBy="rider-form-title" size="sm">
      <div className="p-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 id="rider-form-title" className="m-0 text-xl font-bold">
              Create rider account
            </h2>
            <p className="mb-0 mt-2 text-sm text-slate-500">
              This account will have access to the rider portal.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={close}
            aria-label="Close rider form"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <form onSubmit={submit} onChange={() => setError("")}>
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            <legend className="sr-only">Rider account details</legend>

            <label className="grid gap-2 text-sm font-semibold">
              Full name
              <input
                name="name"
                autoComplete="name"
                maxLength={150}
                required
                className={inputStyle}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                className={inputStyle}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Phone number (optional)
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                className={inputStyle}
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold">
              Password
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

            <p className="m-0 text-xs leading-5 text-slate-500">
              Use at least 8 characters and no more than 72 UTF-8 bytes. Share
              the credentials privately with the rider.
            </p>

            <button
              type="submit"
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create rider"}
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
