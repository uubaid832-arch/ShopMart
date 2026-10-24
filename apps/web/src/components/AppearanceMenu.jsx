import { useId, useState, useSyncExternalStore } from "react";
import { Palette, Sun, Moon, Monitor, X, RotateCcw } from "lucide-react";
import Modal from "./Modal";
import {
  getAppearance,
  subscribeAppearance,
  updateAppearance,
} from "../features/appearance/appearance";

const modes = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const accents = [
  { value: "violet", label: "Violet", color: "#7c3aed" },
  { value: "blue", label: "Blue", color: "#2563eb" },
  { value: "green", label: "Green", color: "#15803d" },
  { value: "orange", label: "Orange", color: "#c2410c" },
];

export default function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    getAppearance,
    getAppearance,
  );
  const id = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Appearance"
        aria-label="Change appearance"
        aria-haspopup="dialog"
        className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-slate-600 hover:bg-violet-50 hover:text-violet-700"
      >
        <Palette size={21} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          labelledBy={`${id}-title`}
          size="sm"
        >
          <div className="grid gap-6 p-5 sm:p-6">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
                  MAKE IT YOURS
                </p>
                <h2 id={`${id}-title`} className="mb-0 mt-2 text-2xl font-bold">
                  Appearance
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close appearance"
                className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-3 text-sm font-bold">Display mode</legend>

              <div className="grid grid-cols-3 gap-2">
                {modes.map(({ value, label, Icon }) => (
                  <label
                    key={value}
                    className={`appearance-choice ${
                      appearance.mode === value ? "is-selected" : ""
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name={`${id}-mode`}
                      value={value}
                      checked={appearance.mode === value}
                      onChange={() => updateAppearance({ mode: value })}
                    />
                    <Icon size={22} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-3 text-sm font-bold">Accent colour</legend>

              <div className="grid grid-cols-4 gap-2">
                {accents.map(({ value, label, color }) => (
                  <label
                    key={value}
                    className={`appearance-choice ${
                      appearance.accent === value ? "is-selected" : ""
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name={`${id}-accent`}
                      value={value}
                      checked={appearance.accent === value}
                      onChange={() => updateAppearance({ accent: value })}
                    />
                    <span
                      aria-hidden="true"
                      className="size-6 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <p
              role="status"
              className="m-0 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"
            >
              {appearance.mode === "system"
                ? `Following your device's ${appearance.theme} mode. `
                : ""}
              Your choices are saved in this browser.
            </p>

            <button
              type="button"
              onClick={() =>
                updateAppearance({ mode: "system", accent: "violet" })
              }
              className="flex items-center justify-center gap-2 rounded-xl border-0 bg-violet-50 p-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reset appearance
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
