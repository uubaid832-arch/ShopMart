import { useRef, useState } from "react";
import Modal from "../../components/Modal";
import SavedAddresses from "./SavedAddresses";
import { useLanguage } from "../language/useLanguage";
import ChangePasswordButton from "../auth/ChangePasswordButton";

function ProfileForm({ profile, onSave }) {
  const { language } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const inFlight = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!onSave || inFlight.current) return;

    const form = event.currentTarget;
    const name = form.elements.namedItem("name");

    name.setCustomValidity(
      name.value.trim()
        ? ""
        : text("Please enter your name.", "براہ کرم اپنا نام درج کریں۔"),
    );

    if (!form.reportValidity()) return;

    const values = Object.fromEntries(
      [...new FormData(form)].map(([key, value]) => [key, value.trim()]),
    );

    inFlight.current = true;
    setSaving(true);
    setFeedback("");

    try {
      await onSave(values);
      setFeedback("saved");
    } catch {
      setFeedback("failed");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="mb-5 mt-0 break-words text-sm text-slate-500">
        {text("Email:", "ای میل:")} <bdi>{profile.email}</bdi>
      </p>

      <fieldset
        disabled={saving}
        className="m-0 grid min-w-0 gap-4 border-0 p-0"
      >
        {[
          {
            name: "name",
            label: text("Full name", "پورا نام"),
            autoComplete: "name",
          },
          {
            name: "phone",
            label: text("Phone number", "فون نمبر"),
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
              dir={name === "phone" ? "ltr" : "auto"}
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
          {saving
            ? text("Saving…", "محفوظ ہو رہا ہے…")
            : text("Save changes", "تبدیلیاں محفوظ کریں")}
        </button>
      </fieldset>

      {!onSave && (
        <p className="text-xs text-slate-500">
          {text(
            "Profile updates are currently unavailable.",
            "فی الحال پروفائل میں تبدیلی کی سہولت دستیاب نہیں۔",
          )}
        </p>
      )}

      <p
        role={feedback === "failed" ? "alert" : "status"}
        className={`text-sm empty:hidden ${
          feedback === "failed" ? "text-rose-700" : "text-violet-700"
        }`}
      >
        {feedback === "saved"
          ? text("Profile updated.", "پروفائل اپ ڈیٹ ہو گئی ہے۔")
          : feedback === "failed"
            ? text(
                "Could not save changes. Please try again.",
                "تبدیلیاں محفوظ نہیں ہو سکیں۔ دوبارہ کوشش کریں۔",
              )
            : ""}
      </p>
    </form>
  );
}

export default function ProfileModal({
  profile = null,
  loading = false,
  error = "",
  accessToken,
  onSave,
  onClose,
  onLogout,
}) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  return (
    <Modal onClose={onClose} labelledBy="profile-title" size="lg">
      <header
        dir={direction}
        className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5"
      >
        <h2 id="profile-title" className="m-0 text-2xl font-bold">
          {text("My Profile", "میری پروفائل")}
        </h2>

        <button
          type="button"
          aria-label={text("Close profile", "پروفائل بند کریں")}
          onClick={onClose}
          className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span aria-hidden="true" className="text-2xl">
            ×
          </span>
        </button>
      </header>

      <div dir={direction} className="p-5" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-slate-500">
            {text("Loading your profile…", "آپ کی پروفائل لوڈ ہو رہی ہے…")}
          </p>
        ) : error ? (
          <p role="alert" className="text-rose-700">
            {text(
              error,
              "پروفائل کی معلومات حاصل نہیں ہو سکیں۔ دوبارہ کوشش کریں یا دوبارہ سائن اِن کریں۔",
            )}
          </p>
        ) : !profile ? (
          <p className="py-5 text-center text-sm text-slate-500">
            {text(
              "Sign in to view your profile and saved addresses.",
              "اپنی پروفائل اور محفوظ پتے دیکھنے کے لیے سائن اِن کریں۔",
            )}
          </p>
        ) : (
          <div className="grid gap-6">
            <ProfileForm key={profile.id} profile={profile} onSave={onSave} />
            <ChangePasswordButton />
            {accessToken && (
              <div className="border-0 border-t border-solid border-slate-200 pt-5">
                <SavedAddresses key={profile.id} accessToken={accessToken} />
              </div>
            )}
          </div>
        )}
      </div>

      {profile && onLogout && (
        <footer
          dir={direction}
          className="border-0 border-t border-solid border-slate-200 p-5"
        >
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-xl border-0 bg-rose-50 p-3 font-semibold text-rose-700 hover:bg-rose-100"
          >
            {text("Sign out", "سائن آؤٹ")}
          </button>
        </footer>
      )}
    </Modal>
  );
}
