import { useRef, useState } from "react";
import Modal from "../../components/Modal";
import { useSession } from "./useSession";
import { changePassword } from "../../api/passwords";

export default function ChangePasswordButton() {
  const { session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  function close() {
    if (!inFlight.current) setOpen(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;

    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get("currentPassword"));
    const newPassword = String(data.get("newPassword"));

    if (newPassword !== data.get("confirmation")) {
      setError("New passwords do not match.");
      return;
    }

    if (
      [currentPassword, newPassword].some(
        (value) => new TextEncoder().encode(value).length > 72,
      )
    ) {
      setError("Passwords must not exceed 72 UTF-8 bytes.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError("");

    try {
      await changePassword(session.accessToken, {
        currentPassword,
        newPassword,
      });
    } catch (failure) {
      setError(failure.message || "Could not change the password.");
      inFlight.current = false;
      setSaving(false);
      return;
    }

    // Password change succeeded and refresh sessions were revoked.
    window.alert("Password changed. Please sign in with your new password.");

    try {
      await signOut();
    } finally {
      window.location.replace("/");
    }
  }

  if (!session) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="rounded-xl border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-200"
      >
        Change password
      </button>

      {open && (
        <Modal onClose={close} labelledBy="change-password-title" size="sm">
          <div className="p-5">
            <header className="mb-5 flex items-center justify-between gap-3">
              <h2 id="change-password-title" className="m-0 text-xl font-bold">
                Change password
              </h2>

              <button
                type="button"
                disabled={saving}
                onClick={close}
                aria-label="Close password form"
                className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <form onSubmit={submit} onChange={() => setError("")}>
              <fieldset
                disabled={saving}
                className="m-0 grid min-w-0 gap-4 border-0 p-0"
              >
                <legend className="sr-only">Password details</legend>

                {[
                  ["currentPassword", "Current password", "current-password"],
                  ["newPassword", "New password", "new-password"],
                  ["confirmation", "Confirm new password", "new-password"],
                ].map(([name, label, autoComplete]) => (
                  <label
                    key={name}
                    className="grid gap-2 text-sm font-semibold"
                  >
                    {label}
                    <input
                      name={name}
                      type="password"
                      autoComplete={autoComplete}
                      required
                      minLength={name === "currentPassword" ? undefined : 8}
                      maxLength={72}
                      className="box-border w-full rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-slate-800"
                    />
                  </label>
                ))}

                <p className="m-0 text-xs leading-5 text-slate-500">
                  Use at least 8 characters. After changing your password, you
                  will need to sign in again.
                </p>

                <button
                  type="submit"
                  className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? "Updating…" : "Update password"}
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
      )}
    </>
  );
}
