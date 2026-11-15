import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useSession } from "../auth/useSession";
import { getNotifications } from "../../api/notifications";
import NotificationsModal from "./NotificationsModal";

function AccountNotificationBell({ session }) {
  const token = session.accessToken;

  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;

    async function refresh() {
      if (pending || controller.signal.aborted) return;
      pending = true;

      try {
        const data = await getNotifications(token, 0, controller.signal);

        if (!controller.signal.aborted) {
          setResult({ token, unread: data.unreadCount });
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
  }, [token, reload]);

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
