import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import {
  loginAccount,
  registerAccount,
  verifyRegistration,
  resendRegistration,
  verifyLoginCode,
  resendLoginCode,
  requestPasswordReset,
  resendPasswordReset,
  resetForgottenPassword,
} from "../../api/auth";
import { useLanguage } from "../language/useLanguage";

const inputClass =
  "box-border w-full min-w-0 rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-slate-800";
const linkClass =
  "rounded-lg border-0 bg-transparent px-2 py-1 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-50 disabled:opacity-50";

export default function AuthModal({ onClose, onAuthenticated }) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);
  const [step, setStep] = useState("login");
  const [challenge, setChallenge] = useState(null);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setShowPassword(false);
  }, [step]);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const verifying = step === "login-code" || step === "register-code" || step === "reset";
  const expired = Boolean(challenge && Date.parse(challenge.expiresAt) <= now);
  const wait = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now) / 1000))
    : 0;

  function move(next) {
    if (inFlight.current) return;
    setStep(next);
    setChallenge(null);
    setShowPassword(false);
    setError("");
    setNotice("");
  }

  function acceptChallenge(value) {
    if (!value?.challengeId || !Number.isFinite(Date.parse(value.expiresAt)) ||
        !Number.isFinite(Date.parse(value.resendAt))) {
      throw new Error(text("Unexpected verification response.", "تصدیق کا جواب درست نہیں ہے۔"));
    }
    setChallenge(value);
    setNow(Date.now());
  }

  async function perform(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      if (mounted.current) {
        setError(language === "ur"
          ? failure.status === 429
            ? "بہت زیادہ کوششیں کی گئی ہیں۔ کچھ دیر بعد دوبارہ کوشش کریں۔"
            : "کارروائی مکمل نہیں ہوئی۔ اپنی تفصیلات، کوڈ اور کنکشن چیک کریں۔"
          : failure.message || "The request could not be completed.");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function validatePasswords(password, confirmation) {
    if (new TextEncoder().encode(password).length > 72) {
      setError(text("Password must not exceed 72 UTF-8 bytes.", "پاس ورڈ 72 UTF-8 بائٹس سے زیادہ نہ ہو۔"));
      return false;
    }
    if (confirmation !== undefined && password !== confirmation) {
      setError(text("Passwords do not match.", "پاس ورڈ ایک جیسے نہیں ہیں۔"));
      return false;
    }
    return true;
  }

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirmation = data.get("confirmation");
    const code = String(data.get("code") ?? "");
    const enteredEmail = String(data.get("email") ?? email).trim();

    if (["login", "register", "reset"].includes(step) &&
        !validatePasswords(password, confirmation === null ? undefined : String(confirmation))) return;
    if (verifying && expired) {
      setError(text("This code expired. Start again to request a new code.", "کوڈ کی مدت ختم ہو گئی۔ نیا کوڈ لینے کے لیے دوبارہ شروع کریں۔"));
      return;
    }
    if (step === "register" && !String(data.get("name")).trim()) {
      setError(text("Please enter your name.", "اپنا نام درج کریں۔"));
      return;
    }

    await perform(async () => {
      if (step === "register") {
        const result = await registerAccount({ name: String(data.get("name")).trim(), email: enteredEmail, password });
        setEmail(enteredEmail);
        acceptChallenge(result);
        setStep("register-code");
        setNotice(text("Check your email to verify and create your account.", "اکاؤنٹ بنانے کے لیے ای میل کا کوڈ درج کریں۔"));
      } else if (step === "register-code") {
        await verifyRegistration(challenge.challengeId, code);
        if (!mounted.current) return;
        setChallenge(null);
        setStep("login");
        setNotice(text("Account created. Sign in using your email and password.", "اکاؤنٹ بن گیا۔ ای میل اور پاس ورڈ سے سائن اِن کریں۔"));
      } else if (step === "login") {
        const result = await loginAccount({ email: enteredEmail, password });
        if (!mounted.current) return;
        if (result?.accessToken) {
          onAuthenticated(result);
          onClose();
          return;
        }
        acceptChallenge(result);
        setEmail(enteredEmail);
        setStep("login-code");
      } else if (step === "login-code") {
        const session = await verifyLoginCode(challenge.challengeId, code);
        if (!mounted.current) return;
        onAuthenticated(session);
        onClose();
      } else if (step === "forgot") {
        const result = await requestPasswordReset(enteredEmail);
        if (!mounted.current) return;
        acceptChallenge(result);
        setEmail(enteredEmail);
        setStep("reset");
      } else if (step === "reset") {
        await resetForgottenPassword(challenge.challengeId, code, password);
        if (!mounted.current) return;
        setChallenge(null);
        setStep("login");
        setNotice(text("Password reset. Sign in with your new password.", "پاس ورڈ تبدیل ہو گیا۔ نئے پاس ورڈ سے سائن اِن کریں۔"));
      }
    });
  }

  async function resend() {
    if (busy || wait > 0 || expired || !challenge) return;
    await perform(async () => {
      const result = step === "register-code" ? await resendRegistration(challenge.challengeId) : step === "login-code"
        ? await resendLoginCode(challenge.challengeId)
        : await resendPasswordReset(challenge.challengeId);
      if (!mounted.current) return;
      acceptChallenge(result);
      setNotice(text("If eligible, a new code has been sent. Use the latest email.", "اہل اکاؤنٹ کے لیے نیا کوڈ بھیج دیا گیا ہے۔ تازہ ترین ای میل استعمال کریں۔"));
    });
  }

  const title = step === "register-code" ? text("Verify your email", "ای میل کی تصدیق کریں") : step === "register"
    ? text("Create an account", "اکاؤنٹ بنائیں")
    : step === "forgot"
      ? text("Forgot password?", "پاس ورڈ بھول گئے؟")
      : step === "reset"
        ? text("Reset your password", "پاس ورڈ دوبارہ بنائیں")
        : step === "login-code"
          ? text("Verify your sign-in", "سائن اِن کی تصدیق کریں")
          : text("Welcome back", "دوبارہ خوش آمدید");

  function passwordField(name, label, autoComplete, minimum) {
    return (
      <label className="grid gap-2 text-sm font-semibold">
        {label}
        <input name={name} type={showPassword ? "text" : "password"} dir="ltr" autoComplete={autoComplete}
          required minLength={minimum} maxLength={72} className={inputClass} />
      </label>
    );
  }

  return (
    <Modal onClose={() => { if (!inFlight.current) onClose(); }} labelledBy="auth-title" size="sm">
      <header dir={direction} className="flex items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            {text("YOUR SHOPMART ACCOUNT", "آپ کا شاپ مارٹ اکاؤنٹ")}
          </p>
          <h2 id="auth-title" className="mb-0 mt-2 text-2xl font-bold">{title}</h2>
        </div>
        <button type="button" disabled={busy} onClick={() => { if (!inFlight.current) onClose(); }}
          aria-label={text("Close account popup", "ونڈو بند کریں")}
          className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50">×</button>
      </header>

      <div dir={direction} className="p-5">
        {verifying && (
          <p className="mt-0 text-sm leading-6 text-slate-600">
            {step === "reset"
              ? text("If this is an enabled customer or rider account, a code was sent to", "اگر یہ فعال صارف یا رائیڈر اکاؤنٹ ہے تو کوڈ بھیجا گیا ہے:")
              : text("Enter the six-digit code sent to", "چھ ہندسوں کا کوڈ درج کریں جو بھیجا گیا ہے:")}
            {" "}<bdi className="font-semibold">{email}</bdi>
            {" "}{text("Check your inbox and spam folder.", "ان باکس اور اسپیم فولڈر دیکھیں۔")}
          </p>
        )}

        <form key={step} onSubmit={submit} onChange={() => setError("")}>
          <fieldset disabled={busy} className="m-0 grid min-w-0 gap-4 border-0 p-0">
            <legend className="sr-only">{text("Account details", "اکاؤنٹ کی تفصیلات")}</legend>
            {step === "register" && (
              <label className="grid gap-2 text-sm font-semibold">
                {text("Full name", "پورا نام")}
                <input name="name" dir="auto" autoComplete="name" required maxLength={150} className={inputClass} />
              </label>
            )}
            {!verifying && (
              <label className="grid gap-2 text-sm font-semibold">
                {text("Email address", "ای میل")}
                <input name="email" type="email" dir="ltr" autoComplete="email" required maxLength={254}
                  defaultValue={email} className={inputClass} />
              </label>
            )}
            {verifying && (
              <label className="grid gap-2 text-sm font-semibold">
                {text("Verification code", "تصدیقی کوڈ")}
                <input name="code" type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
                  required pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000"
                  className={`${inputClass} text-center text-2xl tracking-[0.35em]`} />
              </label>
            )}
            {step === "login" && passwordField("password", text("Password", "پاس ورڈ"), "current-password")}
            {(step === "register" || step === "reset") && (
              <>
                {passwordField("password", text("New password", "نیا پاس ورڈ"), "new-password", 8)}
                {passwordField("confirmation", text("Confirm password", "پاس ورڈ کی تصدیق"), "new-password", 8)}
                <p className="m-0 text-xs leading-5 text-slate-500">
                  {text("Use at least 8 characters and no more than 72 UTF-8 bytes.", "کم از کم 8 حروف اور زیادہ سے زیادہ 72 UTF-8 بائٹس استعمال کریں۔")}
                </p>
              </>
            )}
            {["login", "register", "reset"].includes(step) && (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                  className="size-4 accent-violet-600"
                />
                {text("Show password", "پاس ورڈ دکھائیں")}
              </label>
            )}
            {expired && (
              <p role="status" className="m-0 text-sm text-rose-700">
                {text("This code expired. Start again to get a new one.", "کوڈ کی مدت ختم ہو گئی۔ نیا کوڈ لینے کے لیے دوبارہ شروع کریں۔")}
              </p>
            )}
            <button type="submit" disabled={expired}
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50">
              {busy ? text("Please wait…", "انتظار کریں…")
                : step === "register-code" ? text("Verify & create account", "تصدیق کرکے اکاؤنٹ بنائیں") : step === "register" ? text("Send verification code", "تصدیقی کوڈ بھیجیں")
                  : step === "forgot" ? text("Send reset code", "کوڈ بھیجیں")
                    : step === "reset" ? text("Reset password", "پاس ورڈ تبدیل کریں")
                      : step === "login-code" ? text("Verify and sign in", "تصدیق کرکے سائن اِن کریں")
                        : text("Sign in", "سائن اِن کریں")}
            </button>
          </fieldset>
        </form>

        <p role="alert" className="text-sm text-rose-700 empty:hidden">{error}</p>
        <p role="status" className="text-sm text-violet-700 empty:hidden">{notice}</p>

        {verifying && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" disabled={busy || wait > 0 || expired} onClick={resend} className={linkClass}>
              {wait > 0 ? text(`Resend in ${wait}s`, `${wait} سیکنڈ بعد دوبارہ بھیجیں`)
                : text("Resend code", "کوڈ دوبارہ بھیجیں")}
            </button>
            <button type="button" disabled={busy} onClick={() => move(step === "register-code" ? "register" : step === "reset" ? "forgot" : "login")} className={linkClass}>
              {text("Start again", "دوبارہ شروع کریں")}
            </button>
          </div>
        )}
        {step === "login" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" disabled={busy} onClick={() => move("forgot")} className={linkClass}>
              {text("Forgot password?", "پاس ورڈ بھول گئے؟")}
            </button>
            <button type="button" disabled={busy} onClick={() => move("register")} className={linkClass}>
              {text("Create account", "اکاؤنٹ بنائیں")}
            </button>
          </div>
        )}
        {(step === "register" || step === "forgot" || step === "reset") && (
          <p className="mb-0 mt-4 text-center">
            <button type="button" disabled={busy} onClick={() => move("login")} className={linkClass}>
              {text("Back to sign in", "سائن اِن پر واپس جائیں")}
            </button>
          </p>
        )}
      </div>
    </Modal>
  );
}
