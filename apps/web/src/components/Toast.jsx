import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export default function Toast({
  message,
  type = "success",
  duration = 3500,
  onClose,
  actionLabel,
  onAction,
}) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message || duration <= 0) return undefined;
    const timer = window.setTimeout(() => closeRef.current?.(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);

  if (!message) return null;

  const success = type === "success";
  const tone = success
    ? {
        border: "border-emerald-200",
        icon: "text-emerald-600",
        action: "text-emerald-700 hover:bg-emerald-50",
      }
    : {
        border: "border-rose-200",
        icon: "text-rose-600",
        action: "text-rose-700 hover:bg-rose-50",
      };
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[10000] flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:w-[min(30rem,calc(100vw-3rem))] sm:justify-end sm:px-0">
      <div
        role={success ? "status" : "alert"}
        aria-live={success ? "polite" : "assertive"}
        className={`shopmart-toast-in pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-solid ${tone.border} bg-white px-4 py-3 text-sm text-slate-800 shadow-[0_14px_40px_rgba(15,23,42,0.28)]`}
      >
        <Icon size={19} aria-hidden="true" className={`mt-0.5 shrink-0 ${tone.icon}`} />
        <span className="min-w-0 flex-1 leading-5">{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={() => {
              onAction();
              onClose?.();
            }}
            className={`shrink-0 rounded-lg border-0 bg-transparent px-2 py-1 font-bold ${tone.action}`}
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-slate-500 hover:bg-slate-100"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
