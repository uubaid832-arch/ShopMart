import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const widths = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({
  isOpen = true,
  onClose,
  labelledBy,
  size = "md",
  fixedSections = false,
  children,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    if (!dialog.open) {
      dialog.showModal();
    }

    document.body.style.overflow = "hidden";

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      document.body.style.overflow = previousOverflow;

      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return;

    const bounds = event.currentTarget.getBoundingClientRect();

    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (outside) {
      closeRef.current?.();
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-modal="true"
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current?.();
      }}
      className={`shopmart-modal m-auto box-border max-h-[92dvh] w-[calc(100%-1rem)] rounded-2xl border border-solid border-slate-200 bg-white p-0 text-slate-800 shadow-2xl sm:max-h-[90dvh] sm:w-[calc(100%-3rem)] sm:rounded-3xl ${
        fixedSections
          ? "overflow-hidden open:flex open:flex-col"
          : "overflow-y-auto overscroll-contain"
      } ${widths[size] ?? widths.md}`}
    >
      {children}
    </dialog>,
    document.body,
  );
}
