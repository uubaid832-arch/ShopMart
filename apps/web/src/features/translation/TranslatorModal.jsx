import { useState } from "react";
import { Languages, LoaderCircle, RotateCcw, X } from "lucide-react";
import Modal from "../../components/Modal";
import { useLanguage } from "../language/useLanguage";
import { translateToUrdu } from "../../api/translation";

export default function TranslatorModal({ onClose }) {
  const { language } = useLanguage();
  const urdu = language === "ur";
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleTranslate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setTranslatedText("");
    try {
      setTranslatedText(await translateToUrdu(sourceText));
    } catch (translationError) {
      setError(translationError.message || "Could not translate this text.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="translator-title" size="md">
      <div className="border-0 border-b border-solid border-slate-200 bg-violet-50 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
              <Languages size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="m-0 text-xs font-bold tracking-widest text-violet-700">
                {urdu ? "SHOPMART TRANSLATOR" : "SHOPMART TRANSLATOR"}
              </p>
              <h2 id="translator-title" className="mb-0 mt-1 text-2xl font-extrabold text-slate-900">
                {urdu ? "انگریزی سے اردو" : "English to Urdu"}
              </h2>
              <p className="mb-0 mt-1 text-sm text-slate-600">
                {urdu ? "متن درج کریں اور اس کا اردو ترجمہ حاصل کریں۔" : "Enter text and get an Urdu translation."}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={urdu ? "مترجم بند کریں" : "Close translator"}
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-white text-slate-600 hover:bg-violet-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <form onSubmit={handleTranslate} className="grid gap-4 p-5 sm:p-6">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          <span>{urdu ? "انگریزی متن" : "English text"}</span>
          <textarea
            autoFocus
            required
            maxLength={3000}
            rows={5}
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder={urdu ? "ترجمہ کرنے کے لیے متن لکھیں..." : "Type or paste text to translate..."}
            className="w-full resize-y rounded-xl border border-solid border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-violet-500"
          />
          <span className="text-end text-xs font-normal text-slate-500">{sourceText.length}/3000</span>
        </label>

        <button
          type="submit"
          disabled={busy || !sourceText.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-0 bg-violet-600 px-4 py-3 font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Languages size={18} aria-hidden="true" />}
          {busy ? (urdu ? "ترجمہ ہو رہا ہے…" : "Translating…") : (urdu ? "اردو میں ترجمہ کریں" : "Translate to Urdu")}
        </button>

        {error && <p role="alert" className="m-0 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {translatedText && (
          <section aria-live="polite" className="rounded-2xl border border-solid border-violet-200 bg-violet-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="m-0 text-sm font-bold text-violet-800">{urdu ? "اردو ترجمہ" : "Urdu translation"}</h3>
              <button
                type="button"
                onClick={() => { setSourceText(""); setTranslatedText(""); setError(""); }}
                className="inline-flex items-center gap-1 rounded-lg border-0 bg-white px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
              >
                <RotateCcw size={13} aria-hidden="true" />
                {urdu ? "صاف کریں" : "Clear"}
              </button>
            </div>
            <p dir="rtl" lang="ur" className="m-0 whitespace-pre-wrap text-right text-base leading-8 text-slate-800">{translatedText}</p>
          </section>
        )}
        <p className="m-0 text-xs leading-5 text-slate-500">
          {urdu ? "مشینی ترجمہ غلطی کر سکتا ہے؛ اہم معلومات دوبارہ چیک کریں۔" : "Machine translation can make mistakes; review important details."}
        </p>
      </form>
    </Modal>
  );
}
