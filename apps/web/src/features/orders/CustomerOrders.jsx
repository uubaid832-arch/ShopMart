import { useEffect, useState } from "react";
import { getCustomerOrders } from "../../api/orders";
import OrdersModal from "./OrdersModal";
import { useLanguage } from "../language/useLanguage";

export default function CustomerOrders({ accessToken, formatPrice, onClose }) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    getCustomerOrders(accessToken, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ accessToken, page, data, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            accessToken,
            page,
            data: null,
            error: error.message || "Could not load orders.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, page]);

  const current = result?.accessToken === accessToken && result?.page === page;
  const loading = !current;
  const data = current ? result.data : null;
  const error =
    current && result.error
      ? text(
          result.error,
          "آرڈرز لوڈ نہیں ہو سکے۔ دوبارہ کوشش کریں۔ اگر مسئلہ برقرار رہے تو دوبارہ سائن اِن کریں۔",
        )
      : "";

  const buttonClass =
    "rounded-xl border-0 bg-violet-100 px-4 py-2 font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

  return (
    <OrdersModal
      orders={data?.items ?? []}
      loading={loading}
      error={error}
      formatPrice={formatPrice}
      onClose={onClose}
      footer={
        !loading && !error && data?.totalPages > 1 ? (
          <nav
            dir={direction}
            aria-label={text("Order pages", "آرڈرز کے صفحات")}
            className="flex w-full flex-wrap items-center justify-between gap-3"
          >
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              className={buttonClass}
            >
              {text("← Previous", "→ پچھلا")}
            </button>

            <span className="text-sm text-slate-500">
              <bdi>
                {page + 1} / {data.totalPages}
              </bdi>
            </span>

            <button
              type="button"
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className={buttonClass}
            >
              {text("Next →", "اگلا ←")}
            </button>
          </nav>
        ) : null
      }
    />
  );
}
