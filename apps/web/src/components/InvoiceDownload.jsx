import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { useSession } from "../features/auth/useSession";
import { useLanguage } from "../features/language/useLanguage";

export default function InvoiceDownload({ orderId, admin = false }) {
  const { session } = useSession();
  const { language } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  async function download() {
    if (inFlight.current || !session?.accessToken || !orderId) return;

    inFlight.current = true;
    setDownloading(true);
    setError(false);

    try {
      const prefix = admin ? "/api/admin/orders" : "/api/orders";

      const response = await fetch(
        `${prefix}/${encodeURIComponent(orderId)}/invoice`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Invoice download failed.");
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/pdf")) {
        throw new Error("The server did not return a PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      try {
        link.href = url;
        link.download = `ShopMart-Invoice-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setDownloading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={downloading || !session?.accessToken || !orderId}
        onClick={download}
        className="flex items-center justify-center gap-2 rounded-xl border border-solid border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-50 disabled:opacity-50"
      >
        <Download size={16} aria-hidden="true" />
        {downloading
          ? text("Downloading…", "ڈاؤن لوڈ ہو رہا ہے…")
          : text("Download invoice", "انوائس ڈاؤن لوڈ کریں")}
      </button>

      {error && (
        <p role="alert" className="mb-0 mt-2 text-xs text-rose-700">
          {text(
            "Could not download the invoice. Check your connection and sign-in, then try again.",
            "انوائس ڈاؤن لوڈ نہیں ہو سکی۔ اپنا کنکشن اور سائن اِن چیک کرکے دوبارہ کوشش کریں۔",
          )}
        </p>
      )}
    </div>
  );
}
