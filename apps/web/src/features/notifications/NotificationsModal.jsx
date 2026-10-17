import Modal from "../../components/Modal";

export default function NotificationsModal({
  notifications = [],
  loading = false,
  error = "",
  onClose,
}) {
  return (
    <Modal onClose={onClose} labelledBy="notifications-title" size="md">
      <header className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            SHOPMART UPDATES
          </p>
          <h2 id="notifications-title" className="mb-0 mt-2 text-2xl font-bold">
            Notifications
          </h2>
        </div>

        <button
          type="button"
          aria-label="Close notifications"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>

      <div className="p-5" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-center text-slate-500">
            Loading notifications…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">
            {error}
          </p>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <h3 className="m-0 text-xl font-bold">No notifications to show</h3>
            <p className="mb-0 text-slate-500">
              Order and delivery updates will appear here when available.
            </p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="break-words rounded-xl border border-solid border-slate-200 p-4"
              >
                <h3 className="m-0 text-base font-semibold">
                  {notification.title}
                </h3>
                <p className="mb-2 mt-2 text-sm text-slate-600">
                  {notification.message}
                </p>
                <time
                  dateTime={notification.createdAt}
                  className="text-xs text-slate-500"
                >
                  {new Date(notification.createdAt).toLocaleString("en-PK")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
