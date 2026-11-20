import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { CheckCircle, CircleAlert, X } from "lucide-react";
import { SessionContext } from "./SessionContext";
import { useSessionState } from "./useSession";

export default function SessionProvider({ children }) {
  const state = useSessionState();
  const { notice, dismissNotice } = state;
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    function onActionFeedback(event) {
      setActionNotice({
        id: Date.now(),
        type: event.detail?.type === "error" ? "error" : "success",
        message: event.detail?.message || "Action completed.",
      });
    }
    window.addEventListener("shopmart:action-feedback", onActionFeedback);

    const originalFetch = window.fetch;
    const authHandledPaths = new Set([
      "/api/auth/csrf", "/api/auth/login", "/api/auth/register",
      "/api/auth/login/verify", "/api/auth/login/resend",
      "/api/auth/register/verify", "/api/auth/register/resend",
      "/api/auth/password/forgot", "/api/auth/password/resend",
      "/api/auth/password/reset", "/api/auth/refresh", "/api/auth/logout",
    ]);
    async function trackedFetch(input, init = {}) {
      let method = String(init.method || "GET").toUpperCase();
      let requestUrl = null;
      try {
        requestUrl = new URL(
          typeof input === "string" ? input : input.url,
          window.location.href,
        );
        if (!init.method && typeof Request !== "undefined" && input instanceof Request) {
          method = input.method.toUpperCase();
        }
      } catch { /* Ignore non-URL fetch inputs. */ }
      const shouldNotify = Boolean(
        requestUrl && requestUrl.origin === window.location.origin &&
        requestUrl.pathname.startsWith("/api/") &&
        !requestUrl.pathname.startsWith("/api/rider/deliveries") &&
        method !== "GET" && method !== "HEAD" &&
        !authHandledPaths.has(requestUrl.pathname),
      );

      try {
        const response = await originalFetch.call(window, input, init);
        if (shouldNotify) {
          const payload = response.ok
            ? null
            : await response.clone().json().catch(() => null);
          window.dispatchEvent(new CustomEvent("shopmart:action-feedback", {
            detail: {
              type: response.ok ? "success" : "error",
              message: response.ok
                ? method === "DELETE" ? "Deleted successfully." : "Action completed successfully."
                : payload?.message || payload?.detail || `Request failed (HTTP ${response.status}).`,
            },
          }));
        }
        return response;
      } catch (error) {
        if (shouldNotify && error?.name !== "AbortError") {
          window.dispatchEvent(new CustomEvent("shopmart:action-feedback", {
            detail: { type: "error", message: "The request could not be completed. Check your connection and try again." },
          }));
        }
        throw error;
      }
    }
    window.fetch = trackedFetch;
    return () => {
      window.removeEventListener("shopmart:action-feedback", onActionFeedback);
      if (window.fetch === trackedFetch) window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!actionNotice) return undefined;
    const timer = window.setTimeout(() => setActionNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const visibleNotice = actionNotice || notice;
  const isError = visibleNotice?.type === "error";
  const Icon = isError ? CircleAlert : CheckCircle;

  return (
    <SessionContext.Provider value={state}>
      {children}

      {visibleNotice &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[100] w-[calc(100%-2.5rem)] max-w-sm">
            <div
              role={isError ? "alert" : "status"}
              aria-atomic="true"
              className={`flex items-start gap-3 rounded-2xl border border-solid bg-white p-4 text-slate-700 shadow-xl dark:bg-slate-800 dark:text-slate-100 ${
                isError ? "border-rose-200 dark:border-rose-800" : "border-emerald-200 dark:border-emerald-800"
              }`}
            >
              <Icon
                size={22}
                aria-hidden="true"
                className={`shrink-0 ${
                  isError ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              />

              <p className="m-0 flex-1 text-sm leading-6 dark:text-slate-100">
                {visibleNotice.message}
              </p>

              <button
                type="button"
                onClick={() => actionNotice ? setActionNotice(null) : dismissNotice()}
                aria-label="Dismiss message"
                className="grid size-7 shrink-0 place-items-center rounded-lg border-0 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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
