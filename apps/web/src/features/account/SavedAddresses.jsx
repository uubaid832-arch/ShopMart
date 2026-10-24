import { useEffect, useRef, useState } from "react";
import {
  getAddresses,
  addAddress,
  editAddress,
  deleteAddress,
} from "../../api/addresses";
import AddressBook from "./AddressBook";
import AddressForm from "./AddressForm";
import { useLanguage } from "../language/useLanguage";

export default function SavedAddresses({ accessToken }) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [result, setResult] = useState(null);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    let active = true;

    getAddresses(accessToken)
      .then((items) => {
        if (active) {
          setResult({ token: accessToken, items, error: "" });
        }
      })
      .catch((error) => {
        if (active) {
          setResult({
            token: accessToken,
            items: [],
            error: error.message || "Could not load saved addresses.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  const loading = result?.token !== accessToken;
  const rawError = loading ? "" : result.error;
  const error = rawError
    ? text(
        rawError,
        "محفوظ پتے لوڈ نہیں ہو سکے۔ دوبارہ کوشش کریں یا دوبارہ سائن اِن کریں۔",
      )
    : "";
  const addresses = loading ? [] : result.items;

  async function saveAddress(values) {
    const saved = editor.address
      ? await editAddress(accessToken, editor.address.id, values)
      : await addAddress(accessToken, values);

    setResult((current) => ({
      token: accessToken,
      error: "",
      items: [
        saved,
        ...(current?.items ?? [])
          .filter((item) => item.id !== saved.id)
          .map((item) =>
            saved.isDefault ? { ...item, isDefault: false } : item,
          ),
      ],
    }));

    setEditor(null);
    setFeedback({ type: "saved" });
  }

  async function removeAddress(address) {
    if (deletingRef.current) return;

    if (
      !window.confirm(
        text(
          `Delete "${address.label}" address?`,
          `کیا آپ "${address.label}" والا پتہ حذف کرنا چاہتے ہیں؟`,
        ),
      )
    ) {
      return;
    }

    deletingRef.current = true;
    setDeleting(true);
    setFeedback(null);

    try {
      await deleteAddress(accessToken, address.id);

      setResult((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== address.id),
      }));

      setFeedback({ type: "deleted" });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Could not delete the address.",
      });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  const feedbackText = deleting
    ? text("Deleting address…", "پتہ حذف ہو رہا ہے…")
    : feedback?.type === "saved"
      ? text("Address saved.", "پتہ محفوظ ہو گیا ہے۔")
      : feedback?.type === "deleted"
        ? text("Address deleted.", "پتہ حذف ہو گیا ہے۔")
        : feedback?.type === "error"
          ? text(feedback.message, "پتہ حذف نہیں ہو سکا۔ دوبارہ کوشش کریں۔")
          : "";

  return (
    <div dir={direction}>
      {editor ? (
        <AddressForm
          key={editor.address?.id ?? "new-address"}
          address={editor.address}
          onSave={saveAddress}
          onCancel={() => setEditor(null)}
        />
      ) : (
        <AddressBook
          addresses={addresses}
          loading={loading}
          error={error}
          onAdd={
            loading || error || deleting
              ? undefined
              : () => {
                  setFeedback(null);
                  setEditor({ address: null });
                }
          }
          onEdit={
            loading || error || deleting
              ? undefined
              : (address) => {
                  setFeedback(null);
                  setEditor({ address });
                }
          }
          onDelete={deleting ? undefined : removeAddress}
        />
      )}

      <p
        role={feedback?.type === "error" ? "alert" : "status"}
        className={`mb-0 text-sm empty:hidden ${
          feedback?.type === "error" ? "text-rose-700" : "text-violet-700"
        }`}
      >
        {feedbackText}
      </p>
    </div>
  );
}
