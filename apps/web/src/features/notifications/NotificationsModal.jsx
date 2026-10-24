import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, X } from "lucide-react";
import Modal from "../../components/Modal";
import { useSession } from "../auth/useSession";
import { useLanguage } from "../language/useLanguage";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../api/notifications";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

export default function NotificationsModal({
  accessToken,
  onClose,
  onChanged,
}) {
  const { session } = useSession();
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);
  const locale = language === "ur" ? "ur-PK" : "en-PK";

  const navigate = useNavigate();
  const isAdmin = session?.user.role === "ADMIN";

  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    if (!accessToken) return;

    const controller = new AbortController();

    getNotifications(accessToken, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({
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
          setResult({
            token: accessToken,
            page,
            reload,
            data: null,
            error: error.message || "Could not load notifications.",
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, page, reload]);

  const current =
    result?.token === accessToken &&
    result?.page === page &&
    result?.reload === reload;

  const loading = Boolean(accessToken) && !current;
  const data = current ? result.data : null;

  const error = !accessToken
    ? text(
        "Sign in to view your notifications.",
        "اپنی اطلاعات دیکھنے کے لیے سائن اِن کریں۔",
      )
    : current && result.error
      ? text(
          result.error,
          "اطلاعات لوڈ نہیں ہو سکیں۔ دوبارہ کوشش کریں یا دوبارہ سائن اِن کریں۔",
        )
      : "";

  async function updateRead(notification, openOrder = false) {
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    setActionError("");

    try {
      if (!notification) {
        await markAllNotificationsRead(accessToken);
      } else if (!notification.readAt) {
        await markNotificationRead(accessToken, notification.id);
      }

      setReload((current) => current + 1);
      onChanged?.();

      if (openOrder && isAdmin && notification?.orderId) {
        onClose();

        navigate(
          `/admin/orders?manage=${encodeURIComponent(notification.orderId)}`,
        );
      }
    } catch (error) {
      setActionError(error.message || "Could not update notifications.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy="notifications-title"
      size="md"
      fixedSections
    >
      <header
        dir={direction}
        className="flex shrink-0 items-center justify-between gap-4 bg-violet-50 p-5"
      >
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            {text("SHOPMART UPDATES", "شاپ مارٹ کی تازہ اطلاعات")}
          </p>
          <h2 id="notifications-title" className="mb-0 mt-2 text-2xl font-bold">
            {text("Notifications", "اطلاعات")}
          </h2>
        </div>

        <button
          type="button"
          aria-label={text("Close notifications", "اطلاعات بند کریں")}
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-full border-0 bg-white text-slate-600 hover:bg-violet-100"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div
        dir={direction}
        className="min-h-0 overflow-y-auto overscroll-contain p-5"
        aria-busy={loading || busy}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {data
              ? text(
                  `${data.unreadCount} unread`,
                  `${data.unreadCount} غیر پڑھی ہوئی اطلاعات`,
                )
              : text("Your account updates", "آپ کے اکاؤنٹ کی اطلاعات")}
          </span>

          <div className="flex flex-wrap gap-2">
            {data && data.unreadCount > 0 && (
              <button
                type="button"
                disabled={busy || loading}
                onClick={() => updateRead(null)}
                className={`${buttonStyle} flex items-center gap-2`}
              >
                <CheckCheck size={15} aria-hidden="true" />
                {text("Mark all as read", "سب کو پڑھا ہوا نشان لگائیں")}
              </button>
            )}

            <button
              type="button"
              disabled={loading || busy || !accessToken}
              onClick={() => setReload((current) => current + 1)}
              className={buttonStyle}
            >
              {text("Refresh", "ریفریش")}
            </button>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="text-sm text-rose-700">
            {text(
              actionError,
              "اطلاعات اپ ڈیٹ نہیں ہو سکیں۔ دوبارہ کوشش کریں۔",
            )}
          </p>
        )}

        {busy && (
          <p role="status" className="text-xs text-slate-500">
            {text("Updating notifications…", "اطلاعات اپ ڈیٹ ہو رہی ہیں…")}
          </p>
        )}

        {loading ? (
          <p role="status" className="text-center text-slate-500">
            {text("Loading notifications…", "اطلاعات لوڈ ہو رہی ہیں…")}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : data?.items.length ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {data.items.map((notification) => (
              <li
                key={notification.id}
                className={`rounded-2xl border border-solid p-4 ${
                  notification.readAt
                    ? "border-slate-200 bg-white"
                    : "border-violet-200 bg-violet-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="m-0 min-w-0 break-words text-sm font-bold">
                    <bdi>{notification.title}</bdi>
                  </h3>

                  {!notification.readAt && (
                    <span className="shrink-0 rounded-full bg-violet-600 px-2 py-1 text-[10px] font-bold text-white">
                      {text("New", "نئی")}
                    </span>
                  )}
                </div>

                <p
                  dir="auto"
                  className="mb-3 mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600"
                >
                  {notification.message}
                </p>

                <time
                  dateTime={notification.createdAt}
                  className="block text-xs text-slate-400"
                >
                  {new Date(notification.createdAt).toLocaleString(locale)}
                </time>

                <div className="mt-3 flex flex-wrap gap-2">
                  {isAdmin && notification.orderId && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateRead(notification, true)}
                      className="rounded-lg border-0 bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {text("Open order →", "آرڈر کھولیں ←")}
                    </button>
                  )}

                  {!notification.readAt && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateRead(notification)}
                      className="rounded-lg border-0 bg-slate-100 px-3 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50"
                    >
                      {text("Mark as read", "پڑھا ہوا نشان لگائیں")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center">
            <Bell
              size={36}
              className="mx-auto text-violet-300"
              aria-hidden="true"
            />
            <h3 className="mb-2 mt-4 text-lg font-bold">
              {text("No notifications yet", "ابھی کوئی اطلاع موجود نہیں")}
            </h3>
            <p className="m-0 text-sm text-slate-500">
              {text(
                "New account updates will appear here.",
                "آپ کے اکاؤنٹ کی نئی اطلاعات یہاں نظر آئیں گی۔",
              )}
            </p>
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <footer
          dir={direction}
          className="flex shrink-0 items-center justify-between gap-3 border-0 border-t border-solid border-slate-200 p-5"
        >
          <button
            type="button"
            disabled={page === 0 || busy}
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
            disabled={page + 1 >= data.totalPages || busy}
            onClick={() => setPage((current) => current + 1)}
            className={buttonStyle}
          >
            {text("Next →", "اگلا ←")}
          </button>
        </footer>
      )}
    </Modal>
  );
}
