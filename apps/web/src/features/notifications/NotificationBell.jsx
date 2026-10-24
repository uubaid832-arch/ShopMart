import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, BellRing, X } from "lucide-react";
import { useSession } from "../auth/useSession";
import { getNotifications } from "../../api/notifications";
import NotificationsModal from "./NotificationsModal";

function readPreference(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function readSeen(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function AccountNotificationBell({ session }) {
  const navigate = useNavigate();
  const token = session.accessToken;
  const userId = session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  const preferenceKey = `shopmart-browser-alerts:${userId}`;
  const seenKey = `shopmart-alerts-seen:${userId}`;

  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [enabled, setEnabled] = useState(() => readPreference(preferenceKey));
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");

  const seenRef = useRef(null);
  const alertsRef = useRef(new Set());
  const permissionPending = useRef(false);

  useEffect(() => {
    const alerts = alertsRef.current;

    return () => {
      for (const alert of alerts) {
        alert.onclick = null;
        alert.close();
      }
      alerts.clear();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;

    function remember(ids) {
      const combined = new Set([
        ...readSeen(seenKey),
        ...(seenRef.current ?? []),
        ...ids,
      ]);

      const bounded = [...combined].slice(-500);
      seenRef.current = new Set(bounded);

      try {
        localStorage.setItem(seenKey, JSON.stringify(bounded));
      } catch {
        // Duplicate tracking still works in this component's memory.
      }
    }

    function showNewAlerts(data) {
      const items = data.items ?? [];
      const ids = items.map((item) => item.id);

      // Establish a baseline without alerting for old notifications.
      if (seenRef.current === null) {
        remember(ids);
        return;
      }

      const seen = new Set([...readSeen(seenKey), ...seenRef.current]);

      const fresh = items.filter((item) => !item.readAt && !seen.has(item.id));

      remember(ids);

      if (
        !enabled ||
        !fresh.length ||
        !window.isSecureContext ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      const newest = fresh[0];

      try {
        const alert = new Notification(
          fresh.length === 1
            ? newest.title
            : `ShopMart · ${fresh.length} new updates`,
          {
            body:
              fresh.length === 1
                ? newest.message
                : "Open your notifications to view the latest updates.",
            tag: `shopmart:${userId}:${newest.id}`,
          },
        );

        alertsRef.current.add(alert);

        alert.onclose = () => {
          alertsRef.current.delete(alert);
        };

        alert.onclick = () => {
          window.focus();
          alert.close();

          if (fresh.length === 1 && isAdmin && newest.orderId) {
            navigate(
              `/admin/orders?manage=${encodeURIComponent(newest.orderId)}`,
            );
          } else {
            setOpen(true);
            setReload((value) => value + 1);
          }
        };
      } catch {
        setMessage(
          "System alerts are unavailable in this browser. Your notifications remain available in the bell.",
        );
      }
    }

    async function refresh() {
      if (pending || controller.signal.aborted) return;
      pending = true;

      try {
        const data = await getNotifications(token, 0, controller.signal);

        if (!controller.signal.aborted) {
          setResult({ token, unread: data.unreadCount });
          showNewAlerts(data);
        }
      } catch {
        // Keep the last successful count after a background failure.
      } finally {
        pending = false;
      }
    }

    refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);

    function handleVisibility() {
      if (document.visibilityState === "visible") refresh();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [token, reload, enabled, seenKey, userId, isAdmin, navigate]);

  async function toggleBrowserAlerts() {
    if (permissionPending.current) return;

    if (enabled) {
      setEnabled(false);

      try {
        localStorage.setItem(preferenceKey, "false");
      } catch {
        // The preference still applies for this session.
      }
      for (const alert of alertsRef.current) {
        alert.close();
      }
      alertsRef.current.clear();

      setMessage("Browser alerts are off. The notification bell still works.");
      return;
    }

    if (!window.isSecureContext || !("Notification" in window)) {
      setMessage(
        "Browser alerts require a supported browser using HTTPS or localhost.",
      );
      return;
    }

    if (Notification.permission === "denied") {
      setMessage(
        "Notifications are blocked. Allow them in this site's browser settings, then try again.",
      );
      return;
    }

    permissionPending.current = true;
    setRequesting(true);
    setMessage("");

    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage(
          "Permission was not granted. Notifications remain available in the bell.",
        );
        return;
      }

      setEnabled(true);

      try {
        localStorage.setItem(preferenceKey, "true");
      } catch {
        // The preference still applies for this session.
      }

      setMessage(
        "Browser alerts enabled for this account while ShopMart is open. Old notifications will not be replayed.",
      );
    } catch {
      setMessage("Could not enable browser alerts. Please try again.");
    } finally {
      permissionPending.current = false;
      setRequesting(false);
    }
  }

  const unread = result?.token === token ? result.unread : 0;

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        title="Notifications"
        aria-label={`Notifications, ${unread} unread`}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          setReload((current) => current + 1);
        }}
        className="relative grid size-11 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-slate-600 hover:bg-violet-50 hover:text-violet-700"
      >
        <Bell size={21} strokeWidth={1.8} aria-hidden="true" />

        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 py-0.5 text-[10px] font-bold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <button
        type="button"
        title={enabled ? "Disable browser alerts" : "Enable browser alerts"}
        aria-label={
          enabled ? "Disable browser alerts" : "Enable browser alerts"
        }
        aria-pressed={enabled}
        disabled={requesting}
        onClick={toggleBrowserAlerts}
        className={`grid size-8 shrink-0 place-items-center rounded-lg border-0 disabled:opacity-50 ${
          enabled
            ? "bg-violet-100 text-violet-700"
            : "bg-transparent text-slate-400 hover:bg-violet-50 hover:text-violet-700"
        }`}
      >
        <BellRing size={16} aria-hidden="true" />
      </button>

      {message && (
        <div className="absolute right-0 top-full z-40 mt-3 box-border flex w-64 max-w-[85vw] items-start gap-2 rounded-xl border border-solid border-slate-200 bg-white p-3 shadow-xl">
          <p
            role="status"
            className="m-0 flex-1 text-xs leading-5 text-slate-600"
          >
            {message}
          </p>

          <button
            type="button"
            aria-label="Dismiss browser alert message"
            onClick={() => setMessage("")}
            className="grid size-6 shrink-0 place-items-center rounded-lg border-0 bg-slate-100 text-slate-600"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {open && (
        <NotificationsModal
          accessToken={token}
          onChanged={() => setReload((current) => current + 1)}
          onClose={() => {
            setOpen(false);
            setReload((current) => current + 1);
          }}
        />
      )}
    </div>
  );
}

export default function NotificationBell() {
  const { session } = useSession();

  if (!session) return null;

  return <AccountNotificationBell key={session.user.id} session={session} />;
}
