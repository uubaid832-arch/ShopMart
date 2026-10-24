import { createPortal } from "react-dom";
import { CheckCircle, CircleAlert, X } from "lucide-react";
import { SessionContext } from "./SessionContext";
import { useSessionState } from "./useSession";

export default function SessionProvider({ children }) {
  const state = useSessionState();
  const { notice, dismissNotice } = state;

  const isError = notice?.type === "error";
  const Icon = isError ? CircleAlert : CheckCircle;

  return (
    <SessionContext.Provider value={state}>
      {children}

      {notice &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[100] w-[calc(100%-2.5rem)] max-w-sm">
            <div
              role={isError ? "alert" : "status"}
              aria-atomic="true"
              className={`flex items-start gap-3 rounded-2xl border border-solid bg-white p-4 shadow-xl ${
                isError ? "border-rose-200" : "border-emerald-200"
              }`}
            >
              <Icon
                size={22}
                aria-hidden="true"
                className={`shrink-0 ${
                  isError ? "text-rose-600" : "text-emerald-600"
                }`}
              />

              <p className="m-0 flex-1 text-sm leading-6 text-slate-700">
                {notice.message}
              </p>

              <button
                type="button"
                onClick={dismissNotice}
                aria-label="Dismiss message"
                className="grid size-7 shrink-0 place-items-center rounded-lg border-0 bg-slate-50 text-slate-500 hover:bg-slate-100"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </SessionContext.Provider>
  );
}
