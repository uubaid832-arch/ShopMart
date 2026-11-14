import { useEffect, useRef, useState } from "react";
import { KeyRound, MapPinned, UserRound } from "lucide-react";
import { getWarehouseReturnAddress, saveWarehouseReturnAddress } from "../../api/adminStoreSettings";
import ChangePasswordButton from "../auth/ChangePasswordButton";
import { useSession } from "../auth/useSession";

const inputClass = "box-border w-full rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 text-sm text-slate-800";

export default function AdminAccount() {
  const { session, saveProfile } = useSession();
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [address, setAddress] = useState("");
  const [savedAddress, setSavedAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressSaved, setAddressSaved] = useState(false);
  const addressInFlight = useRef(false);

  useEffect(() => {
    if (!session?.accessToken) return undefined;
    const controller = new AbortController();
    getWarehouseReturnAddress(session.accessToken, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setAddress(value);
          setSavedAddress(value);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setAddressError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAddressLoading(false);
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
      setProfileError("Enter your name.");
      return;
    }
    setProfileBusy(true);
    setProfileError("");
    setProfileSaved(false);
    try {
      await saveProfile(values);
      setProfileSaved(true);
    } catch (failure) {
      setProfileError(failure.message || "Could not save account details.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveAddressForm(event) {
    event.preventDefault();
    if (addressInFlight.current) return;
    if (address.trim().length < 10) {
      setAddressError("Enter the full warehouse address, city, and contact details.");
      return;
    }
    addressInFlight.current = true;
    setAddressBusy(true);
    setAddressError("");
    setAddressSaved(false);
    try {
      const value = await saveWarehouseReturnAddress(session.accessToken, address);
      setAddress(value);
      setSavedAddress(value);
      setAddressSaved(true);
    } catch (failure) {
      setAddressError(failure.message || "Could not save the warehouse address.");
    } finally {
      addressInFlight.current = false;
      setAddressBusy(false);
    }
  }

  if (!session) return null;

  return (
    <div className="grid gap-5">
      <header>
        <p className="mb-2 mt-0 text-xs font-bold uppercase tracking-widest text-violet-600">Administrator settings</p>
        <h1 className="m-0 text-3xl font-bold">My account</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">Edit your account, password, and the address customers use for returns.</p>
      </header>

      <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><UserRound size={21} aria-hidden="true" /></span>
          <div><h2 className="m-0 text-lg font-bold">Account details</h2><p className="mb-0 mt-1 text-sm text-slate-500">{session.user.email}</p></div>
        </div>
        <form onSubmit={saveAccount} onChange={() => { setProfileError(""); setProfileSaved(false); }} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">Name<input className={inputClass} name="name" autoComplete="name" defaultValue={session.user.name || ""} required /></label>
          <label className="grid gap-2 text-sm font-semibold">Phone<input className={inputClass} name="phone" type="tel" autoComplete="tel" defaultValue={session.user.phone || ""} /></label>
          {profileError && <p role="alert" className="m-0 text-sm text-rose-700 sm:col-span-2">{profileError}</p>}
          {profileSaved && <p role="status" className="m-0 text-sm text-emerald-700 sm:col-span-2">Account details saved.</p>}
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
          <div><h2 className="m-0 text-lg font-bold">Warehouse return address</h2><p className="mb-0 mt-1 text-sm text-slate-500">This address is included in web and mobile return instructions.</p></div>
        </div>
        <form onSubmit={saveAddressForm} className="grid gap-3">
          <label htmlFor="admin-warehouse-address" className="grid gap-2 text-sm font-semibold">Full address, city, and contact number<textarea id="admin-warehouse-address" className={`${inputClass} resize-y`} value={address} onChange={(event) => { setAddress(event.target.value); setAddressError(""); setAddressSaved(false); }} maxLength={1500} rows={4} disabled={addressLoading || addressBusy} placeholder="Street and building, area, city, and warehouse phone number" /></label>
          <p className="m-0 text-xs leading-5 text-slate-500">Include enough detail for a customer or courier to find the warehouse.</p>
          {addressError && <p role="alert" className="m-0 text-sm text-rose-700">{addressError}</p>}
          {addressSaved && <p role="status" className="m-0 text-sm text-emerald-700">Warehouse return address saved.</p>}
          <div><button type="submit" disabled={addressLoading || addressBusy || address.trim() === savedAddress.trim()} className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-sm font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50">{addressLoading ? "Loading saved address…" : addressBusy ? "Saving address…" : "Save warehouse address"}</button></div>
        </form>
      </section>
    </div>
  );
}
