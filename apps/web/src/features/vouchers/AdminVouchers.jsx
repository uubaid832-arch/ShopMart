import { useEffect, useRef, useState } from "react";
import { TicketPercent, Plus, RefreshCw } from "lucide-react";
import { useSession } from "../auth/useSession";
import { voucherRequest } from "../../api/vouchers";
const input =
  "w-full rounded-xl border border-solid border-violet-200 bg-white p-3 text-sm";
const button =
  "rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50";
const initial = () => ({
  requestId: crypto.randomUUID(),
  code: `SHOP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  kind: "PERCENT",
  value: "10",
  minSubtotal: "1000",
  maxDiscount: "",
  usageLimit: 100,
  perUserLimit: 1,
  validDays: 30,
});
export default function AdminVouchers() {
  const { session } = useSession();
  const token = session.accessToken;
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    voucherRequest(token, `/admin/vouchers?page=${page}&size=15`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ token, page, revision, data, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({
            token,
            page,
            revision,
            data: null,
            error: failure.message,
          });
      });
    return () => controller.abort();
  }, [token, page, revision]);
  const current =
    result?.token === token &&
    result?.page === page &&
    result?.revision === revision;
  const data = current ? result.data : null;
  async function mutate(action, success) {
    if (pending.current || uncertain) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setForm(null);
    } catch (failure) {
      setError(failure.message);
      if (!failure.status || failure.status >= 500) setUncertain(true);
    } finally {
      pending.current = false;
      setBusy(false);
      setRevision((v) => v + 1);
    }
  }
  function field(key, label, type = "text", extra = {}) {
    return (
      <label className="grid gap-2 text-sm font-semibold">
        {label}
        <input
          required={key !== "maxDiscount"}
          type={type}
          value={form[key]}
          onChange={(event) =>
            setForm({
              ...form,
              [key]:
                key === "code"
                  ? event.target.value.toUpperCase()
                  : event.target.value,
            })
          }
          className={input}
          {...extra}
        />
      </label>
    );
  }
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 flex items-center gap-2 text-2xl font-extrabold">
            <TicketPercent />
            Vouchers & discounts
          </h1>
          <p className="mb-0 text-sm text-slate-500">
            Create codes for both web and mobile checkout.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Refresh vouchers"
            disabled={busy}
            onClick={() => {
              setUncertain(false);
              setRevision((v) => v + 1);
            }}
            className="rounded-xl border-0 bg-violet-100 p-3 text-violet-700"
          >
            <RefreshCw size={19} />
          </button>
          <button
            type="button"
            disabled={busy || uncertain}
            onClick={() => {
              setError("");
              setForm(initial());
            }}
            className={`${button} flex items-center gap-2`}
          >
            <Plus size={17} />
            Generate voucher
          </button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {uncertain && (
        <p role="alert" className="text-sm text-rose-700">
          The result is uncertain. Close the form and refresh the list before
          submitting another code.
        </p>
      )}
      {form && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutate(
              () =>
                voucherRequest(token, "/admin/vouchers", {
                  method: "POST",
                  values: {
                    ...form,
                    maxDiscount: form.maxDiscount || null,
                    usageLimit: Number(form.usageLimit),
                    perUserLimit: Number(form.perUserLimit),
                    validDays: Number(form.validDays),
                  },
                }),
              "Voucher created.",
            );
          }}
          className="rounded-2xl border border-solid border-violet-100 bg-violet-50 p-5"
        >
          <h2 className="mt-0 text-lg font-bold">New voucher</h2>
          <fieldset
            disabled={busy || uncertain}
            className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2"
          >
            {field("code", "Voucher code", "text", {
              maxLength: 40,
              pattern: "[A-Z0-9][A-Z0-9_-]{2,39}",
            })}
            <label className="grid gap-2 text-sm font-semibold">
              Discount type
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm({ ...form, kind: event.target.value })
                }
                className={input}
              >
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount in PKR</option>
              </select>
            </label>
            {field(
              "value",
              form.kind === "PERCENT"
                ? "Percentage (up to 99%)"
                : "Discount (PKR)",
              "number",
              {
                min: 0.01,
                max: form.kind === "PERCENT" ? 99 : 9999999999.99,
                step: 0.01,
              },
            )}
            {field("minSubtotal", "Minimum product subtotal (PKR)", "number", {
              min: 0,
              step: 0.01,
            })}
            {field(
              "maxDiscount",
              "Maximum discount (optional, PKR)",
              "number",
              { min: 0.01, step: 0.01 },
            )}
            {field("usageLimit", "Total allowed uses", "number", {
              min: 1,
              max: 1000000,
            })}
            {field("perUserLimit", "Uses per customer", "number", {
              min: 1,
              max: Number(form.usageLimit),
            })}
            {field("validDays", "Valid for (days)", "number", {
              min: 1,
              max: 3650,
            })}
          </fieldset>
          <p className="text-xs leading-5 text-slate-500">
            Codes activate immediately. Cancellations do not restore used
            allowances. Disable a voucher to stop future uses; existing order
            discounts remain unchanged.
          </p>
          <div className="flex gap-2">
            <button disabled={busy || uncertain} className={button}>
              {busy ? "Saving..." : "Create voucher"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setForm(null)}
              className="rounded-xl border-0 bg-white px-4 py-3 text-sm text-violet-700"
            >
              Close
            </button>
          </div>
        </form>
      )}
      {!current ? (
        <p>Loading vouchers...</p>
      ) : result.error ? (
        <p role="alert" className="text-rose-700">
          {result.error}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.items.length ? (
            data.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
              >
                <div className="flex justify-between gap-3">
                  <code className="select-all text-lg font-bold text-violet-700">
                    {item.code}
                  </code>
                  <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs">
                    {!item.enabled
                      ? "Disabled"
                      : new Date(item.expiresAt) <= new Date()
                        ? "Expired"
                        : item.used >= item.usageLimit
                          ? "Used up"
                          : "Active"}
                  </span>
                </div>
                <p className="text-2xl font-extrabold">
                  {item.kind === "PERCENT"
                    ? `${Number(item.value)}%`
                    : `PKR ${Number(item.value).toLocaleString("en-PK")}`}{" "}
                  off
                </p>
                <p className="text-sm text-slate-500">
                  Minimum PKR {Number(item.minSubtotal).toLocaleString("en-PK")}
                  {item.maxDiscount
                    ? ` · Maximum saving PKR ${Number(item.maxDiscount).toLocaleString("en-PK")}`
                    : ""}
                </p>
                <p className="text-sm">
                  {item.used} / {item.usageLimit} uses · {item.perUserLimit} per
                  customer
                </p>
                <p className="text-xs text-slate-500">
                  Expires {new Date(item.expiresAt).toLocaleString("en-PK")}
                </p>
                <button
                  type="button"
                  disabled={busy || uncertain}
                  className={button}
                  onClick={() => {
                    if (
                      window.confirm(
                        `${item.enabled ? "Disable" : "Enable"} ${item.code}?`,
                      )
                    )
                      mutate(
                        () =>
                          voucherRequest(token, `/admin/vouchers/${item.id}`, {
                            method: "PATCH",
                            values: {
                              enabled: !item.enabled,
                              version: item.version,
                            },
                          }),
                        "Voucher status updated.",
                      );
                  }}
                >
                  {item.enabled ? "Disable" : "Enable"}
                </button>
              </article>
            ))
          ) : (
            <p>No vouchers yet. Generate your first discount code above.</p>
          )}
        </div>
      )}
      <footer className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={busy || page === 0}
          onClick={() => setPage((v) => v - 1)}
          className={button}
        >
          Previous
        </button>
        <span className="text-sm text-slate-500">
          Page {page + 1} / {Math.max(1, data?.totalPages || 1)}
        </span>
        <button
          type="button"
          disabled={busy || !data || page + 1 >= data.totalPages}
          onClick={() => setPage((v) => v + 1)}
          className={button}
        >
          Next
        </button>
      </footer>
    </div>
  );
}
