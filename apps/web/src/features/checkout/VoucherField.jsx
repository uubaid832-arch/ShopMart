import { TicketPercent } from "lucide-react";
import { useLanguage } from "../language/useLanguage";
export default function VoucherField({ voucher, disabled }) {
  const { language } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);
  return (
    <section className="mt-5 rounded-2xl border border-solid border-violet-100 bg-violet-50 p-4">
      <label
        htmlFor="checkout-voucher"
        className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-800"
      >
        <TicketPercent size={18} />
        {text("Have a voucher?", "کیا آپ کے پاس واؤچر ہے؟")}
      </label>
      <div className="flex gap-2">
        <input
          id="checkout-voucher"
          value={voucher.code}
          onChange={(event) => voucher.change(event.target.value)}
          disabled={disabled || voucher.busy}
          maxLength={40}
          autoComplete="off"
          placeholder={text("Enter discount code", "ڈسکاؤنٹ کوڈ درج کریں")}
          className="min-w-0 flex-1 rounded-xl border border-solid border-violet-200 bg-white p-3 text-sm uppercase"
        />
        <button
          type="button"
          disabled={disabled || voucher.busy || !voucher.code.trim()}
          onClick={voucher.quote ? voucher.remove : voucher.apply}
          className="rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {voucher.busy
            ? text("Checking...", "تصدیق جاری ہے...")
            : voucher.quote
              ? text("Remove", "ہٹائیں")
              : text("Apply", "لاگو کریں")}
        </button>
      </div>
      {voucher.quote && (
        <p role="status" className="mb-0 text-sm text-emerald-700">
          {voucher.quote.code} · {text("You save", "آپ کی بچت")} PKR{" "}
          {Number(voucher.quote.discountAmount).toLocaleString("en-PK")}
        </p>
      )}
      {voucher.error && (
        <p role="alert" className="mb-0 text-sm text-rose-700">
          {voucher.error}
        </p>
      )}
      <p className="mb-0 text-xs leading-5 text-slate-500">
        {text(
          "One voucher per order. Eligibility is checked again when placing your order.",
          "ہر آرڈر پر ایک واؤچر۔ آرڈر دیتے وقت دوبارہ تصدیق کی جائے گی۔",
        )}
      </p>
    </section>
  );
}
