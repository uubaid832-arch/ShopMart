import { useLanguage } from "../language/useLanguage";

export default function AddressBook({
  addresses = [],
  loading = false,
  error = "",
  onAdd,
  onEdit,
  onDelete,
}) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  return (
    <section
      dir={direction}
      aria-labelledby="addresses-title"
      className="grid gap-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="addresses-title" className="m-0 text-xl font-bold">
            {text("Saved addresses", "محفوظ پتے")}
          </h2>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            {text(
              "Manage your delivery addresses.",
              "اپنے ڈیلیوری پتے شامل، تبدیل یا حذف کریں۔",
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={!onAdd || loading}
          className="rounded-xl border-0 bg-violet-600 px-4 py-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
        >
          {text("+ Add address", "+ پتہ شامل کریں")}
        </button>
      </header>

      <div aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            {text("Loading addresses…", "پتے لوڈ ہو رہے ہیں…")}
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">
            {error}
          </p>
        ) : addresses.length === 0 ? (
          <p className="m-0 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
            {text(
              "No saved addresses to display.",
              "ابھی کوئی پتہ محفوظ نہیں ہے۔",
            )}
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="rounded-xl border border-solid border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="m-0 break-words text-base font-bold">
                    <bdi>{address.label}</bdi>
                  </h3>

                  {address.isDefault && (
                    <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                      {text("Default", "بنیادی پتہ")}
                    </span>
                  )}
                </div>

                <address className="mt-3 break-words text-sm not-italic text-slate-600">
                  <p className="m-0 font-semibold">
                    <bdi>{address.recipientName}</bdi>
                  </p>

                  <p className="mb-0 mt-1">
                    <bdi>{address.phone}</bdi>
                  </p>

                  <p className="mb-0 mt-2">
                    <bdi>{address.addressLine}</bdi>
                  </p>

                  <p className="mb-0 mt-1">
                    <bdi>
                      {[
                        address.city,
                        address.postalCode,
                        address.country === "Pakistan"
                          ? text("Pakistan", "پاکستان")
                          : address.country,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </bdi>
                  </p>
                </address>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!onEdit}
                    onClick={() => onEdit?.(address)}
                    aria-label={text(
                      `Edit ${address.label} address`,
                      `${address.label} والا پتہ تبدیل کریں`,
                    )}
                    className="rounded-lg border-0 bg-violet-50 px-3 py-2 font-semibold text-violet-700 enabled:hover:bg-violet-100 disabled:opacity-50"
                  >
                    {text("Edit", "تبدیل کریں")}
                  </button>

                  <button
                    type="button"
                    disabled={!onDelete}
                    onClick={() => onDelete?.(address)}
                    aria-label={text(
                      `Delete ${address.label} address`,
                      `${address.label} والا پتہ حذف کریں`,
                    )}
                    className="rounded-lg border-0 bg-rose-50 px-3 py-2 font-semibold text-rose-700 enabled:hover:bg-rose-100 disabled:opacity-50"
                  >
                    {text("Delete", "حذف کریں")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!onAdd && !onEdit && !loading && !error && (
        <p className="m-0 text-xs text-slate-500">
          {text(
            "Address management is currently unavailable.",
            "فی الحال پتے شامل یا تبدیل کرنے کی سہولت دستیاب نہیں۔",
          )}
        </p>
      )}
    </section>
  );
}
