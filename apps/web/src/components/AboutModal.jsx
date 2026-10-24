import { Package, ShieldCheck, Truck, X } from "lucide-react";
import Modal from "./Modal";
import { useLanguage } from "../features/language/useLanguage";

const features = [
  {
    Icon: Package,
    title: ["Everyday shopping", "روزمرہ کی خریداری"],
    description: [
      "Explore products, save favourites and manage your cart.",
      "مصنوعات دیکھیں، پسندیدہ مصنوعات محفوظ کریں اور اپنی ٹوکری ترتیب دیں۔",
    ],
  },
  {
    Icon: ShieldCheck,
    title: ["Your own account", "آپ کا ذاتی اکاؤنٹ"],
    description: [
      "Manage your profile, saved addresses and purchase history.",
      "اپنی پروفائل، محفوظ پتے اور خریداری کی تفصیلات دیکھیں اور ترتیب دیں۔",
    ],
  },
  {
    Icon: Truck,
    title: ["Order updates", "آرڈر کی پیش رفت"],
    description: [
      "Follow your order from confirmation through delivery.",
      "تصدیق سے ڈیلیوری تک اپنے آرڈر کی صورتحال دیکھیں۔",
    ],
  },
];

export default function AboutModal({ onClose }) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  return (
    <Modal onClose={onClose} labelledBy="about-title" size="lg">
      <div
        dir={direction}
        className="relative overflow-hidden rounded-t-3xl bg-violet-600 p-6 text-white sm:p-8"
      >
        <button
          type="button"
          aria-label={text("Close About Us", "ہمارے بارے میں ونڈو بند کریں")}
          onClick={onClose}
          className="absolute end-4 top-4 grid size-10 place-items-center rounded-full border-0 bg-white/15 text-white hover:bg-white/25"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <p className="mb-3 mt-0 pe-12 text-xs font-bold tracking-widest text-violet-200">
          {text("ABOUT SHOPMART", "شاپ مارٹ کے بارے میں")}
        </p>

        <h2
          id="about-title"
          className="m-0 max-w-sm pe-10 text-3xl font-extrabold leading-tight"
        >
          {text(
            "Your everyday finds, together.",
            "روزمرہ کی پسندیدہ مصنوعات، ایک جگہ۔",
          )}
        </h2>

        <p className="mb-0 mt-4 max-w-md text-sm leading-6 text-violet-100">
          {text(
            "ShopMart brings browsing, ordering and order management into one convenient shopping experience.",
            "شاپ مارٹ مصنوعات دیکھنے، آرڈر دینے اور آرڈرز کی تفصیلات سنبھالنے کی سہولیات ایک آسان خریداری کے تجربے میں یکجا کرتا ہے۔",
          )}
        </p>
      </div>

      <div dir={direction} className="p-6 sm:p-8">
        <div className="grid gap-5">
          {features.map(({ Icon, title, description }) => (
            <section key={title[0]} className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Icon size={21} aria-hidden="true" />
              </span>

              <div>
                <h3 className="m-0 text-sm font-bold text-slate-800">
                  {text(...title)}
                </h3>
                <p className="mb-0 mt-1 text-sm leading-6 text-slate-500">
                  {text(...description)}
                </p>
              </div>
            </section>
          ))}
        </div>

        <p className="mb-0 mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          {text(
            "ShopMart is a final-year academic project. Payment methods and delivery features are available according to the current implementation.",
            "شاپ مارٹ فائنل ایئر کا ایک تعلیمی منصوبہ ہے۔ ادائیگی اور ڈیلیوری کی سہولیات موجودہ نظام میں شامل خصوصیات کے مطابق دستیاب ہیں۔",
          )}
        </p>
      </div>
    </Modal>
  );
}
