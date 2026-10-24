import { useRef, useState } from "react";
import { useLanguage } from "../language/useLanguage";

const fields = [
  {
    name: "label",
    label: ["Address label", "پتے کا نام"],
    autoComplete: "section-address nickname",
  },
  {
    name: "recipientName",
    label: ["Recipient name", "وصول کنندہ کا نام"],
    autoComplete: "section-address name",
  },
  {
    name: "phone",
    label: ["Phone number", "فون نمبر"],
    type: "tel",
    autoComplete: "section-address tel",
  },
  {
    name: "addressLine",
    label: ["Street address", "گلی اور مکان کا پتہ"],
    autoComplete: "section-address street-address",
  },
  {
    name: "city",
    label: ["City", "شہر"],
    autoComplete: "section-address address-level2",
  },
  {
    name: "postalCode",
    label: ["Postal code (optional)", "پوسٹل کوڈ (اختیاری)"],
    autoComplete: "section-address postal-code",
  },
];

export default function AddressForm({ address, onSave, onCancel }) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current || !onSave) return;

    const form = event.currentTarget;

    fields.forEach(({ name }) => {
      const input = form.elements.namedItem(name);

      input.setCustomValidity(
        input.required && !input.value.trim()
          ? text("Please complete this field.", "براہ کرم یہ خانہ مکمل کریں۔")
          : "",
      );
    });

    if (!form.reportValidity()) return;

    const data = new FormData(form);

    const values = {
      ...Object.fromEntries(
        [...data].map(([key, value]) => [key, value.trim()]),
      ),
      isDefault: data.has("isDefault"),
    };

    inFlight.current = true;
    setSaving(true);
    setFeedback(null);

    try {
      await onSave(values);
    } catch (error) {
      setFeedback({
        message: error.message || "Could not save your address.",
      });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section dir={direction} className="rounded-xl bg-slate-50 p-4">
      <h3 className="mb-4 mt-0 text-lg font-bold">
        {address
          ? text("Edit address", "پتہ تبدیل کریں")
          : text("Add address", "پتہ شامل کریں")}
      </h3>

      <form
        onSubmit={handleSubmit}
        onInput={(event) => {
          event.target.setCustomValidity?.("");
          setFeedback(null);
        }}
      >
        <fieldset
          disabled={saving}
          className="m-0 grid min-w-0 gap-4 border-0 p-0"
        >
          <legend className="sr-only">
            {text("Address details", "پتے کی تفصیلات")}
          </legend>

          {fields.map(({ name, label, type = "text", autoComplete }) => (
            <label key={name} className="grid gap-2 text-sm font-semibold">
              {text(...label)}
              <input
                name={name}
                type={type}
                dir={["phone", "postalCode"].includes(name) ? "ltr" : "auto"}
                autoComplete={autoComplete}
                defaultValue={address?.[name] ?? ""}
                required={name !== "postalCode"}
                maxLength={
                  name === "addressLine"
                    ? 250
                    : name === "phone"
                      ? 32
                      : name === "postalCode"
                        ? 20
                        : 100
                }
                className="box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-white p-3"
              />
            </label>
          ))}

          <label className="grid gap-2 text-sm font-semibold">
            {text("Country", "ملک")}
            <select
              name="country"
              autoComplete="section-address country-name"
              defaultValue={address?.country ?? "Pakistan"}
              className="box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-white p-3"
            >
              <option value="Pakistan">{text("Pakistan", "پاکستان")}</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isDefault"
              defaultChecked={address?.isDefault ?? false}
              className="size-4 accent-violet-600"
            />
            {text("Use as my default address", "اسے میرا بنیادی پتہ بنائیں")}
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!onSave}
              className="rounded-xl border-0 bg-violet-600 px-4 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              {saving
                ? text("Saving…", "محفوظ ہو رہا ہے…")
                : address
                  ? text("Save changes", "تبدیلیاں محفوظ کریں")
                  : text("Save address", "پتہ محفوظ کریں")}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border-0 bg-white px-4 py-3 font-semibold text-slate-600 enabled:hover:bg-slate-200 disabled:opacity-50"
            >
              {text("Cancel", "منسوخ کریں")}
            </button>
          </div>
        </fieldset>

        <p
          role="alert"
          className="mb-0 mt-3 text-sm text-rose-700 empty:hidden"
        >
          {feedback
            ? text(
                feedback.message,
                "پتہ محفوظ نہیں ہو سکا۔ اپنی تفصیلات چیک کرکے دوبارہ کوشش کریں۔",
              )
            : ""}
        </p>
      </form>
    </section>
  );
}
