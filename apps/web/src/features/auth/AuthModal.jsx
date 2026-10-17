import { useState } from "react";
import Modal from "../../components/Modal";

export default function AuthModal({ onClose }) {
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState("");

  const fields = [
    ...(registering
      ? [{ name: "name", label: "Full name", autoComplete: "name" }]
      : []),
    {
      name: "email",
      label: "Email address",
      type: "email",
      autoComplete: "email",
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      autoComplete: registering ? "new-password" : "current-password",
    },
    ...(registering
      ? [
          {
            name: "confirmPassword",
            label: "Confirm password",
            type: "password",
            autoComplete: "new-password",
          },
        ]
      : []),
  ];

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;

    if (registering) {
      const name = form.elements.namedItem("name");
      const password = form.elements.namedItem("password");
      const confirmation = form.elements.namedItem("confirmPassword");

      name.setCustomValidity(
        name.value.trim() ? "" : "Please enter your name.",
      );
      confirmation.setCustomValidity(
        password.value === confirmation.value ? "" : "Passwords do not match.",
      );
    }

    if (!form.reportValidity()) return;

    setNotice(
      registering
        ? "Form validated. Registration will be available when connected."
        : "Form validated. Sign-in will be available when connected.",
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="auth-title" size="sm">
      {" "}
      <header className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            YOUR SHOPMART ACCOUNT
          </p>
          <h2 id="auth-title" className="mb-0 mt-2 text-2xl font-bold">
            {registering ? "Create an account" : "Welcome back"}
          </h2>
        </div>

        <button
          type="button"
          aria-label="Close account popup"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
        >
          <span className="text-2xl">×</span>
        </button>
      </header>
      <div className="p-5">
        <p className="mb-5 mt-0 rounded-xl bg-violet-50 p-3 text-xs text-slate-600">
          Frontend preview · Sign-in and registration are not connected yet.
        </p>

        <form
          key={registering ? "register" : "login"}
          onSubmit={handleSubmit}
          onInput={(event) => {
            event.target.setCustomValidity("");
            event.currentTarget.elements
              .namedItem("confirmPassword")
              ?.setCustomValidity("");
            setNotice("");
          }}
        >
          <div className="grid gap-4">
            {fields.map(({ name, label, type, autoComplete }) => (
              <label
                key={name}
                htmlFor={`auth-${name}`}
                className="grid gap-2 text-sm font-semibold"
              >
                {label}
                <input
                  id={`auth-${name}`}
                  name={name}
                  type={type ?? "text"}
                  autoComplete={autoComplete}
                  required
                  className="box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit] text-slate-800 focus:border-violet-500"
                />
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="mt-5 w-full rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white hover:bg-violet-700"
          >
            {registering ? "Preview registration" : "Preview sign-in"}
          </button>

          <p role="status" className="text-sm text-violet-700 empty:hidden">
            {notice}
          </p>
        </form>

        <p className="mb-0 mt-5 text-center text-sm text-slate-500">
          {registering ? "Already have an account?" : "New to ShopMart?"}{" "}
          <button
            type="button"
            onClick={() => {
              setRegistering((current) => !current);
              setNotice("");
            }}
            className="rounded-lg border-0 bg-transparent px-2 py-1 font-semibold text-violet-700 hover:bg-violet-50"
          >
            {registering ? "Log in" : "Register"}
          </button>
        </p>
      </div>
    </Modal>
  );
}
