import { useState } from "react";
import Modal from "../../components/Modal";

function ProfileForm({ profile, onSave }) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!onSave || saving) return;

    const form = event.currentTarget;
    const name = form.elements.namedItem("name");

    name.setCustomValidity(name.value.trim() ? "" : "Please enter your name.");
    if (!form.reportValidity()) return;

    const values = Object.fromEntries(
      [...new FormData(form)].map(([key, value]) => [key, value.trim()]),
    );

    setSaving(true);
    setFeedback("");

    try {
      await onSave(values);
      setFeedback("Profile updated.");
    } catch {
      setFeedback("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-5 mt-0 break-words text-sm text-slate-500">
        Email: {profile.email}
      </p>

      <fieldset
        disabled={saving}
        className="m-0 grid min-w-0 gap-4 border-0 p-0"
      >
        {[
          { name: "name", label: "Full name", autoComplete: "name" },
          {
            name: "phone",
            label: "Phone number",
            type: "tel",
            autoComplete: "tel",
          },
        ].map(({ name, label, type, autoComplete }) => (
          <label
            key={name}
            htmlFor={`profile-${name}`}
            className="grid gap-2 text-sm font-semibold"
          >
            {label}
            <input
              id={`profile-${name}`}
              name={name}
              type={type ?? "text"}
              autoComplete={autoComplete}
              defaultValue={profile[name] ?? ""}
              required={name === "name"}
              onInput={(event) => {
                event.target.setCustomValidity("");
                setFeedback("");
              }}
              className="box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-slate-800"
            />
          </label>
        ))}

        <button
          type="submit"
          disabled={!onSave || saving}
          className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </fieldset>

      {!onSave && (
        <p className="text-xs text-slate-500">
          Profile updates are currently unavailable.
        </p>
      )}

      <p role="status" className="text-sm text-violet-700 empty:hidden">
        {feedback}
      </p>
    </form>
  );
}

export default function ProfileModal({
  profile = null,
  loading = false,
  error = "",
  onSave,
  onClose,
}) {
  return (
    <Modal onClose={onClose} labelledBy="profile-title" size="sm">
      <header className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <h2 id="profile-title" className="m-0 text-2xl font-bold">
          My Profile
        </h2>

        <button
          type="button"
          aria-label="Close profile"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>

      <div className="p-5" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-slate-500">
            Loading your profile…
          </p>
        ) : error ? (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        ) : profile ? (
          <ProfileForm key={profile.id} profile={profile} onSave={onSave} />
        ) : (
          <p className="py-5 text-center text-sm text-slate-500">
            No profile is available. Your details will appear after sign-in is
            connected.
          </p>
        )}
      </div>
    </Modal>
  );
}
