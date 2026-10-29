import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import Modal from "../../components/Modal";
import { getCustomerOrders, getOrderTracking } from "../../api/orders";
import { useLanguage } from "../language/useLanguage";
import DeliveryLocationMap from "./DeliveryLocationMap";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

const statusTranslations = {
  PENDING: ["Pending", "زیرِ التوا"],
  CONFIRMED: ["Confirmed", "تصدیق شدہ"],
  DISPATCHED: ["Dispatched", "روانہ ہو گیا"],
  DELIVERED: ["Delivered", "پہنچا دیا گیا"],
  CANCELLED: ["Cancelled", "منسوخ"],
  RETURNED: ["Returned", "واپس ہو گیا"],
};

export default function TrackingModal({ accessToken, onClose, initialOrderId = null }) {
  const { language, direction } = useLanguage();
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);
  const locale = urdu ? "ur-PK" : "en-PK";

  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [reload, setReload] = useState(0);
  const [ordersResult, setOrdersResult] = useState(null);
  const [trackingResult, setTrackingResult] = useState(null);

  function statusLabel(value = "") {
    const key = String(value).toUpperCase().replaceAll(" ", "_");
    const labels = statusTranslations[key];

    return labels ? text(...labels) : String(value).replaceAll("_", " ");
  }

  function eventLabel(event) {
    // Translate explicit status codes without guessing what a message means.
    const key = String(event.status ?? "").toUpperCase();
    const labels = statusTranslations[key];

    if (urdu && labels) {
      return `آرڈر کی حیثیت: ${labels[1]}`;
    }

    return event.message || statusLabel(event.status);
  }

  useEffect(() => {
    if (!accessToken || initialOrderId) return;

    const controller = new AbortController();

    getCustomerOrders(accessToken, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOrdersResult({
            token: accessToken,
            page,
            reload,
            data,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setOrdersResult({
            token: accessToken,
            page,
            reload,
            data: null,
            error: error.message || "Could not load orders.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, page, reload, initialOrderId]);

  const ordersCurrent = Boolean(initialOrderId) || (
    ordersResult?.token === accessToken &&
    ordersResult?.page === page &&
    ordersResult?.reload === reload
  );

  const data = ordersCurrent ? ordersResult?.data : null;
  const orders = initialOrderId
    ? []
    : (data?.items ?? []).filter((item) =>
        ["PENDING", "CONFIRMED", "DISPATCHED"].includes(item.status),
      );
  const order = initialOrderId
    ? null
    : orders.find((item) => item.id === selectedId) ?? orders[0];
  const orderId = initialOrderId ?? order?.id;

  useEffect(() => {
    if (!accessToken || !orderId) return;

    const controller = new AbortController();

    getOrderTracking(accessToken, orderId, controller.signal)
      .then((tracking) => {
        if (!controller.signal.aborted) {
          setTrackingResult({
            token: accessToken,
            id: orderId,
            reload,
            tracking,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setTrackingResult({
            token: accessToken,
            id: orderId,
            reload,
            tracking: null,
            error: error.message || "Could not load tracking updates.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, orderId, reload]);

  const trackingCurrent =
    trackingResult?.token === accessToken &&
    trackingResult?.id === orderId &&
    trackingResult?.reload === reload;

  const tracking = trackingCurrent ? trackingResult.tracking : null;

  const error = !accessToken
    ? text(
        "Please sign in to track your orders.",
        "اپنے آرڈرز کی صورتحال دیکھنے کے لیے سائن اِن کریں۔",
      )
    : !initialOrderId && ordersCurrent && ordersResult?.error
      ? text(
          ordersResult.error,
          "آرڈرز لوڈ نہیں ہو سکے۔ دوبارہ کوشش کریں یا دوبارہ سائن اِن کریں۔",
        )
      : "";

  const loading = Boolean(accessToken) && !initialOrderId && !ordersCurrent;

  return (
    <Modal
      onClose={onClose}
      labelledBy="tracking-title"
      size="lg"
      fixedSections
    >
      <header
        dir={direction}
        className="flex shrink-0 items-start justify-between gap-4 bg-violet-50 p-5"
      >
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            {text("YOUR DELIVERY", "آپ کی ڈیلیوری")}
          </p>

          <h2 id="tracking-title" className="mb-0 mt-2 text-2xl font-bold">
            {text("Track your order", "اپنے آرڈر کی صورتحال دیکھیں")}
          </h2>
        </div>

        <button
          type="button"
          aria-label={text("Close order tracking", "آرڈر کی صورتحال بند کریں")}
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-white text-slate-600 hover:bg-violet-100"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div
        dir={direction}
        className="min-h-0 overflow-y-auto overscroll-contain p-5"
        aria-busy={loading}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="m-0 text-xs text-slate-500">
            {text(
              "Refresh to check the latest order updates.",
              "آرڈر کی تازہ صورتحال دیکھنے کے لیے ریفریش کریں۔",
            )}
          </p>

          <button
            type="button"
            disabled={loading || !accessToken}
            onClick={() => setReload((current) => current + 1)}
            className={`${buttonStyle} flex shrink-0 items-center gap-2`}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {text("Refresh", "ریفریش")}
          </button>
        </div>

        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            {text("Loading your orders…", "آپ کے آرڈرز لوڈ ہو رہے ہیں…")}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : orders.length === 0 && !initialOrderId ? (
          <div className="py-8 text-center">
            <h3 className="m-0 text-lg font-bold">
              {text("No orders to track", "دیکھنے کے لیے کوئی آرڈر موجود نہیں")}
            </h3>
            <p className="mb-0 mt-2 text-sm text-slate-500">
              {text(
                "Your orders will appear here after checkout.",
                "چیک آؤٹ مکمل ہونے کے بعد آپ کے آرڈرز یہاں نظر آئیں گے۔",
              )}
            </p>
          </div>
        ) : (
          <>
            {!initialOrderId && <label className="grid gap-2 text-sm font-semibold">
              {text("Select an order", "آرڈر منتخب کریں")}
              <select
                value={orderId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-white p-3"
              >
                {orders.map((item) => {
                  const products = item.items
                    .map((product) => product.name)
                    .join(", ");

                  const date = new Date(item.createdAt).toLocaleDateString(
                    locale,
                    { day: "numeric", month: "short" },
                  );

                  return (
                    <option key={item.id} value={item.id}>
                      {products} · {date}
                    </option>
                  );
                })}
              </select>
            </label>}

            {!initialOrderId && data?.totalPages > 1 && (
              <nav
                aria-label={text("Order pages", "آرڈرز کے صفحات")}
                className="mt-3 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((current) => current - 1)}
                  className={buttonStyle}
                >
                  {text("← Previous", "→ پچھلا")}
                </button>

                <span className="text-xs text-slate-500">
                  <bdi>
                    {page + 1} / {data.totalPages}
                  </bdi>
                </span>

                <button
                  type="button"
                  disabled={page + 1 >= data.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className={buttonStyle}
                >
                  {text("Next →", "اگلا ←")}
                </button>
              </nav>
            )}

            {!trackingCurrent ? (
              <p role="status" className="mt-5 text-sm text-slate-500">
                {text(
                  "Loading tracking updates…",
                  "آرڈر کی تازہ صورتحال لوڈ ہو رہی ہے…",
                )}
              </p>
            ) : trackingResult.error ? (
              <p role="alert" className="mt-5 text-sm text-rose-700">
                {text(
                  trackingResult.error,
                  "آرڈر کی صورتحال لوڈ نہیں ہو سکی۔ ریفریش کرکے دوبارہ کوشش کریں۔",
                )}
              </p>
            ) : (
              <>
                <section className="mt-5 rounded-2xl bg-violet-50 p-5">
                  <p className="m-0 text-xs font-bold tracking-wide text-violet-600">
                    {text("CURRENT STATUS", "موجودہ حیثیت")}
                  </p>

                  <p
                    role="status"
                    className="mb-0 mt-2 text-2xl font-bold capitalize text-violet-800"
                  >
                    {statusLabel(tracking.status)}
                  </p>
                </section>

                <section className="mt-6">
                  <h3 className="mb-4 mt-0 text-base font-bold">
                    {text("Tracking updates", "آرڈر کی پیش رفت")}
                  </h3>

                  {tracking.events.length ? (
                    <ol className="m-0 list-none p-0">
                      {tracking.events.map((event, index) => {
                        const latest = index === tracking.events.length - 1;

                        return (
                          <li
                            key={event.id}
                            className="relative ms-2 border-0 border-s-2 border-solid border-violet-100 pb-6 ps-6 last:pb-0"
                          >
                            <span
                              aria-hidden="true"
                              className={`absolute -start-[7px] top-1 size-3 rounded-full ${
                                latest ? "bg-violet-600" : "bg-violet-200"
                              }`}
                            />

                            <p
                              className={`m-0 whitespace-pre-wrap break-words text-sm font-semibold ${
                                latest ? "text-violet-800" : "text-slate-700"
                              }`}
                            >
                              <bdi>{eventLabel(event)}</bdi>
                            </p>

                            <time
                              dateTime={event.createdAt}
                              className="mt-1 block text-xs text-slate-500"
                            >
                              {new Date(event.createdAt).toLocaleString(locale)}
                            </time>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {text(
                        "No tracking updates available yet.",
                        "ابھی آرڈر کی پیش رفت کی کوئی اطلاع موجود نہیں۔",
                      )}
                    </p>
                  )}
                </section>

                {tracking.status === "DISPATCHED" && <DeliveryLocationMap
                  key={orderId}
                  token={accessToken}
                  orderId={orderId}
                />}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
