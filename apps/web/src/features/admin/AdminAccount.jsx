import { useEffect, useState } from "react";
import { KeyRound, MapPinned, UserRound } from "lucide-react";
import { getAdminStoreProfile, saveAdminStoreProfile } from "../../api/adminStoreSettings";
import ChangePasswordButton from "../auth/ChangePasswordButton";
import { useSession } from "../auth/useSession";
import { useLanguage } from "../language/useLanguage";
import AppearanceMenu from "../../components/AppearanceMenu";

const inputClass = "box-border w-full rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-sm text-slate-800";
const emptyStoreProfile = { operatingCities: ["Lahore"], warehouseAddressLine: "", warehouseCity: "Lahore", warehousePhone: "", whatsappNumber: "923263101049", bankName: "ShopMart Demo Bank (fictional)", bankAccountTitle: "ShopMart Test Store", bankAccountNumber: "0000 0000 0000", bankIban: "PK00-DEMO-0000-0000-0000", deliveryFee: "0.00", freeDeliveryThreshold: "0.00", announcementMessages: [] };

export default function AdminAccount() {
  const { session, saveProfile } = useSession();
  const { language, setLanguage } = useLanguage();
  const [profileBusy, setProfileBusy] = useState(false);
  const [storeProfile, setStoreProfile] = useState(emptyStoreProfile);
  const [operatingCities, setOperatingCities] = useState(["Lahore"]);
  const [cityDraft, setCityDraft] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    if (!session?.accessToken) return undefined;
    const controller = new AbortController();
    getAdminStoreProfile(session.accessToken, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          const profile = { ...emptyStoreProfile, ...value };
          setStoreProfile(profile);
          setOperatingCities(profile.operatingCities || []);
          setSettingsError("");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setSettingsError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettingsLoading(false);
      });
    return () => controller.abort();
  }, [session?.accessToken]);

  async function saveAccount(event) {
    event.preventDefault();
    if (profileBusy) return;
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
    };
    if (!values.name) {
      window.dispatchEvent(new CustomEvent("shopmart:action-feedback", { detail: { type: "error", message: "Enter your name." } }));
      return;
    }
    setProfileBusy(true);
    try {
      await saveProfile(values);
    } catch {
      // The shared API action toast reports request failures.
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveStoreSettings(event) {
    event.preventDefault();
    setSettingsBusy(true);
    try {
      const saved = await saveAdminStoreProfile(session.accessToken, { ...storeProfile, operatingCities });
      setStoreProfile(saved); setOperatingCities(saved.operatingCities || []);
    } catch {
      // The shared API action toast reports request failures.
    } finally {
      setSettingsBusy(false);
    }
  }

  function addCity() {
    const city = cityDraft.trim().replace(/\s+/g, " ");
    if (!city) return;
    if (!operatingCities.some((value) => value.toLowerCase() === city.toLowerCase())) {
      setOperatingCities([...operatingCities, city]);
    }
    setCityDraft("");
  }

  if (!session) return null;

  return (
    <div className="grid gap-5">
      <header>
        <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-widest text-violet-600">Administrator settings</p>
        <h1 className="m-0 text-3xl font-bold">My account</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">Manage delivery cities, warehouse return details, and bank transfer contact information.</p>
      </header>

      <section className="grid gap-3 rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="m-0 text-lg font-bold">App settings</h2>
        <button type="button" onClick={() => setLanguage(language === "en" ? "ur" : "en")} className="flex w-full items-center justify-between gap-3 rounded-xl border border-solid border-slate-200 bg-white p-3 text-start hover:bg-violet-50">
          <span><strong className="block text-sm">App language</strong><small className="mt-1 block text-xs text-slate-500">Choose English or Urdu for ShopMart</small></span>
          <span className="rounded-lg bg-violet-100 px-3 py-2 text-sm font-bold text-violet-700">{language === "ur" ? "اردو" : "English"}</span>
        </button>
        <AppearanceMenu settings />
      </section>

      <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><UserRound size={21} aria-hidden="true" /></span>
          <div><h2 className="m-0 text-lg font-bold">Account details</h2><p className="mb-0 mt-1 text-sm text-slate-500">{session.user.email}</p></div>
        </div>
        <form onSubmit={saveAccount} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">Name<input className={inputClass} name="name" autoComplete="name" defaultValue={session.user.name || ""} required /></label>
          <label className="grid gap-2 text-sm font-semibold">Phone<input className={inputClass} name="phone" type="tel" autoComplete="tel" defaultValue={session.user.phone || ""} /></label>
          <button type="submit" disabled={profileBusy} className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-sm font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50 sm:col-span-2">{profileBusy ? "Saving…" : "Save account details"}</button>
        </form>
      </section>

      <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><KeyRound size={21} aria-hidden="true" /></span>
          <div><h2 className="m-0 text-lg font-bold">Password</h2><p className="mb-0 mt-1 text-sm text-slate-500">Change the password used to sign in to the admin portal.</p></div>
        </div>
        <ChangePasswordButton />
      </section>

      <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MapPinned size={21} aria-hidden="true" /></span>
          <div><h2 className="m-0 text-lg font-bold">Store delivery & payment settings</h2><p className="mb-0 mt-1 text-sm text-slate-500">These settings control checkout city choices, return instructions, and bank transfer details.</p></div>
        </div>
        <form onSubmit={saveStoreSettings} className="grid gap-4">
          <div className="grid gap-2 text-sm font-semibold">
            <span>Operating cities</span>
            <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-solid border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-950">
              {operatingCities.map((city) => (
                <span key={city} className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1.5 text-sm font-bold text-sky-900 dark:bg-slate-700 dark:text-sky-200">
                  {city}
                  <button type="button" aria-label={`Remove ${city}`} disabled={settingsLoading || settingsBusy} onClick={() => setOperatingCities(operatingCities.filter((value) => value !== city))} className="grid size-5 place-items-center rounded-full border-0 bg-transparent text-current hover:bg-black/10">×</button>
                </span>
              ))}
              <input className="min-w-40 flex-1 border-0 bg-transparent p-2 text-sm font-normal text-slate-800 outline-none dark:text-slate-100" value={cityDraft} onChange={(event) => setCityDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addCity(); } }} onBlur={addCity} placeholder="Type a city and press Enter" disabled={settingsLoading || settingsBusy} />
            </div>
          </div>
          <p className="-mt-3 m-0 text-xs text-slate-500">Press Enter to add a city. Customers can select from these saved cities at checkout.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">Warehouse street address<input className={inputClass} value={storeProfile.warehouseAddressLine} onChange={(event) => setStoreProfile({ ...storeProfile, warehouseAddressLine: event.target.value })} maxLength={1000} placeholder="Building, street, area" disabled={settingsLoading || settingsBusy} /></label>
            <label className="grid gap-2 text-sm font-semibold">Warehouse city<input className={inputClass} value={storeProfile.warehouseCity} onChange={(event) => setStoreProfile({ ...storeProfile, warehouseCity: event.target.value })} maxLength={100} placeholder="City" disabled={settingsLoading || settingsBusy} /></label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">Warehouse contact number<input className={inputClass} type="tel" value={storeProfile.warehousePhone} onChange={(event) => setStoreProfile({ ...storeProfile, warehousePhone: event.target.value })} maxLength={32} placeholder="Optional contact number" disabled={settingsLoading || settingsBusy} /></label>
          </div>
          <div className="grid gap-3 rounded-xl border border-solid border-slate-200 p-4 sm:grid-cols-2">
            <h3 className="m-0 text-base font-bold sm:col-span-2">Delivery charges</h3>
            <label className="grid gap-2 text-sm font-semibold">Delivery fee (PKR)<input className={inputClass} type="number" min="0" step="0.01" value={storeProfile.deliveryFee ?? "0.00"} onChange={(event) => setStoreProfile({ ...storeProfile, deliveryFee: event.target.value })} disabled={settingsLoading || settingsBusy} /></label>
            <label className="grid gap-2 text-sm font-semibold">Free delivery for orders at or above (PKR)<input className={inputClass} type="number" min="0" step="0.01" value={storeProfile.freeDeliveryThreshold ?? "0.00"} onChange={(event) => setStoreProfile({ ...storeProfile, freeDeliveryThreshold: event.target.value })} disabled={settingsLoading || settingsBusy} /></label>
            <p className="m-0 text-xs font-normal text-slate-500 sm:col-span-2">Set the free delivery amount to 0 to keep free delivery disabled. Delivery is free when the discounted product total reaches the threshold.</p>
          </div>
          <div className="grid gap-3 rounded-xl border border-solid border-slate-200 p-4">
            <label className="grid gap-2 text-sm font-semibold">Rotating storefront announcements<textarea className={`${inputClass} min-h-28 resize-y`} value={(storeProfile.announcementMessages || []).join("\n")} onChange={(event) => setStoreProfile({ ...storeProfile, announcementMessages: event.target.value.split("\n").slice(0, 20) })} maxLength={5000} placeholder={"One message per line, for example:\nFree delivery on orders above PKR 5,000\nNew arrivals are here"} disabled={settingsLoading || settingsBusy} /></label>
            <p className="m-0 text-xs font-normal text-slate-500">Messages rotate in the storefront ticker. Add up to 20 messages, one per line.</p>
          </div>
          <div className="grid gap-3 rounded-xl border border-solid border-slate-200 p-4 sm:grid-cols-2">
            <h3 className="m-0 text-base font-bold sm:col-span-2">Bank transfer checkout details</h3>
            <label className="grid gap-2 text-sm font-semibold">WhatsApp number (country code)<input className={inputClass} type="tel" value={storeProfile.whatsappNumber} onChange={(event) => setStoreProfile({ ...storeProfile, whatsappNumber: event.target.value })} maxLength={32} placeholder="923001234567" disabled={settingsLoading || settingsBusy} /></label>
            <label className="grid gap-2 text-sm font-semibold">Bank name<input className={inputClass} value={storeProfile.bankName} onChange={(event) => setStoreProfile({ ...storeProfile, bankName: event.target.value })} maxLength={120} disabled={settingsLoading || settingsBusy} /></label>
            <label className="grid gap-2 text-sm font-semibold">Account title<input className={inputClass} value={storeProfile.bankAccountTitle} onChange={(event) => setStoreProfile({ ...storeProfile, bankAccountTitle: event.target.value })} maxLength={120} disabled={settingsLoading || settingsBusy} /></label>
            <label className="grid gap-2 text-sm font-semibold">Account number<input className={inputClass} value={storeProfile.bankAccountNumber} onChange={(event) => setStoreProfile({ ...storeProfile, bankAccountNumber: event.target.value })} maxLength={80} disabled={settingsLoading || settingsBusy} /></label>
            <label className="grid gap-2 text-sm font-semibold sm:col-span-2">IBAN<input className={inputClass} value={storeProfile.bankIban} onChange={(event) => setStoreProfile({ ...storeProfile, bankIban: event.target.value })} maxLength={80} disabled={settingsLoading || settingsBusy} /></label>
          </div>
          {settingsError && <p role="alert" className="m-0 text-sm text-rose-700">{settingsError}</p>}
          <div><button type="submit" disabled={settingsLoading || settingsBusy} className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-sm font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50">{settingsLoading ? "Loading settings…" : settingsBusy ? "Saving settings…" : "Save store settings"}</button></div>
        </form>
      </section>
    </div>
  );
}
