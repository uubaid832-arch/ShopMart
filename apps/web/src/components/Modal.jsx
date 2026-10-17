import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const widths = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-3xl",
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

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) return;

    const { left, right, top, bottom } =
      event.currentTarget.getBoundingClientRect();

    if (
      event.clientX < left ||
      event.clientX > right ||
      event.clientY < top ||
      event.clientY > bottom
    ) {
      onClose();
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] rounded-3xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm ${
        fixedSections
          ? "overflow-hidden open:flex open:flex-col"
          : "overflow-y-auto"
      } ${widths[size] ?? widths.md}`}
    >
      {children}
    </dialog>,
    document.body,
  );
}
