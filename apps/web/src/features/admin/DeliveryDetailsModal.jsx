import { useRef, useState } from "react";
import CustomerContact from "./CustomerContact";
import { useSession } from "../auth/useSession";
import Modal from "../../components/Modal";

const inputStyle =
  "box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3 font-[inherit] text-slate-800";

const reasons = {
  CUSTOMER_REFUSED: "Customer refused the order",
  CUSTOMER_UNAVAILABLE: "Customer unavailable",
  UNREACHABLE: "Customer not answering",
  INCORRECT_ADDRESS: "Incorrect or incomplete address",
  DAMAGED_PACKAGE: "Package damaged",
  OTHER: "Other delivery problem",
};

export default function DeliveryDetailsModal({ delivery, onSave, onClose }) {
  const { session } = useSession();
  const [values, setValues] = useState({
    name: delivery.customerName ?? "",
    email: delivery.email ?? "",
    phone: delivery.phone ?? "",
    addressLine: delivery.addressLine ?? "",
    city: delivery.city ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  const canEdit = delivery.canEditDetails;

  function close() {
    if (!pending.current) onClose();
  }

  function update(event) {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: name === "phone" ? value.replace(/\D/g, "").slice(0, 11) : value,
    }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canEdit || pending.current) return;

    const data = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()]),
    );

    if (
      !data.name ||
      !data.addressLine ||
      !data.city ||
      !/^[0-9]{11}$/.test(data.phone)
    ) {
      setError("Complete the details and enter an 11-digit phone number.");
      return;
    }

    pending.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave(data);
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal onClose={close} labelledBy="delivery-details-title" size="lg">
      <div className="grid gap-5 p-5 sm:p-6">
        {delivery.status === "DISPATCHED" && delivery.failureReason && <CustomerContact token={session.accessToken} item={delivery} />}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
              CUSTOMER SUPPORT
            </p>
            <h2
              id="delivery-details-title"
              className="mb-0 mt-2 text-2xl font-bold"
            >
              Contact & delivery details
            </h2>
            <p className="mb-0 mt-2 break-all text-xs text-slate-400">
              {delivery.orderNumber}
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={close}
            aria-label="Close delivery details"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <section className="rounded-2xl bg-violet-50 p-4">
          <h3 className="m-0 text-base font-bold">Contact customer</h3>
          <p className="mb-3 mt-2 text-sm text-slate-600">
            Confirm the correct details with the customer before saving.
          </p>

          <div className="flex flex-wrap gap-3">
            {delivery.phone && (
              <a
                href={`tel:${delivery.phone}`}
                className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Call {delivery.phone}
              </a>
            )}

            {delivery.email && (
              <a
                href={`mailto:${delivery.email}?subject=${encodeURIComponent(
                  `ShopMart order ${delivery.orderNumber}`,
                )}`}
                className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-violet-700"
              >
                Email customer
              </a>
            )}
          </div>
        </section>

        {delivery.failureReason && (
          <section className="rounded-2xl bg-amber-50 p-4">
            <h3 className="m-0 text-sm font-bold text-amber-900">
              Last unsuccessful delivery
            </h3>
            <p className="mb-0 mt-2 text-sm text-amber-800">
              {reasons[delivery.failureReason] ?? delivery.failureReason}
            </p>

            {delivery.failureNote && (
              <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm text-amber-800">
                {delivery.failureNote}
              </p>
            )}
          </section>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset
            disabled={!canEdit || saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2"
          >
            <legend className="mb-4 text-lg font-bold">Delivery details</legend>

            {[
              ["name", "Recipient name", "text", 150],
              ["email", "Email address", "email", 254],
              ["phone", "Phone number", "tel", 11],
              ["city", "City", "text", 150],
            ].map(([name, label, type, maxLength]) => (
              <label key={name} className="grid gap-2 text-sm font-semibold">
                {label}
                <input
                  name={name}
                  type={type}
                  required
                  maxLength={maxLength}
                  inputMode={name === "phone" ? "numeric" : undefined}
                  pattern={name === "phone" ? "[0-9]{11}" : undefined}
                  title={
                    name === "phone" ? "Enter exactly 11 digits." : undefined
                  }
                  value={values[name]}
                  onChange={update}
                  className={inputStyle}
                />
              </label>
            ))}

            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
              Street address
              <textarea
                name="addressLine"
                rows={3}
                required
                maxLength={500}
                value={values.addressLine}
                onChange={update}
                className={`${inputStyle} resize-y`}
              />
            </label>

            {canEdit && (
              <button
                type="submit"
                className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50 sm:col-span-2"
              >
                {saving ? "Saving…" : "Save delivery details"}
              </button>
            )}
          </fieldset>

          <p className="mb-0 mt-3 text-xs leading-5 text-slate-500">
            {canEdit
              ? "Changes apply to this order only. The customer and assigned rider will be notified."
              : "Delivery details are read-only at this order stage."}
          </p>

          {error && (
            <p role="alert" className="mb-0 mt-3 text-sm text-rose-700">
              {error}
            </p>
          )}
        </form>
      </div>
    </Modal>
  );
}
