import { useEffect, useMemo, useState } from "react";
import { useSession } from "../auth/useSession";
import { getAdminProducts } from "../../api/adminProducts";
import { voucherRequest } from "../../api/vouchers";

const input = "w-full rounded-xl border border-solid border-slate-300 bg-white p-3 text-sm";

export default function AdminProductDiscounts() {
  const { session } = useSession();
  const token = session.accessToken;
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getAdminProducts(token, controller.signal),
      voucherRequest(token, "/admin/product-discounts", { signal: controller.signal }),
    ]).then(([allProducts, allCampaigns]) => {
      if (!controller.signal.aborted) { setProducts(allProducts); setCampaigns(allCampaigns); setError(""); }
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [token, revision]);
  const activeProductIds = useMemo(() => new Set(campaigns.filter((c) => c.enabled).flatMap((c) => c.products.map((p) => p.productId))), [campaigns]);
  const visibleProducts = products.filter((product) => `${product.name} ${product.categoryName ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  async function save() {
    const chosen = Object.entries(selected).filter(([, value]) => value.checked);
    if (!name.trim() || !chosen.length) { setError("Enter a campaign name and choose at least one product."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await voucherRequest(token, "/admin/product-discounts", { method: "POST", values: {
        requestId: crypto.randomUUID(), name: name.trim(),
        products: chosen.map(([productId, value]) => ({ productId, kind: value.kind, value: Number(value.value) })),
      } });
      setName(""); setSelected({}); setNotice("Automatic discount campaign created."); setRevision((v) => v + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function toggle(campaign) {
    setBusy(true); setError(""); setNotice("");
    try {
      await voucherRequest(token, `/admin/product-discounts/${campaign.id}`, { method: "PATCH", values: { enabled: !campaign.enabled, version: campaign.version } });
      setNotice(`Campaign ${campaign.enabled ? "disabled" : "enabled"}.`); setRevision((v) => v + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-5">
    <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
      <h2 className="m-0 text-xl font-extrabold">Automatic product discount</h2>
      <p className="text-sm text-slate-600">Choose products and set a separate percentage or PKR discount for each. Discounted products are excluded from voucher codes.</p>
      <label className="grid gap-2 text-sm font-semibold">Campaign name<input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Weekend sale" /></label>
      <label className="mt-4 grid gap-2 text-sm font-semibold">Find products<input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" /></label>
      <div className="mt-4 grid max-h-96 gap-2 overflow-auto">
        {visibleProducts.map((product) => {
          const locked = activeProductIds.has(product.id) || !product.active;
          const rule = selected[product.id] ?? { checked: false, kind: "PERCENT", value: "10" };
          return <div key={product.id} className="grid gap-2 rounded-xl border border-solid border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <label className="flex items-center gap-2"><input type="checkbox" disabled={locked || busy} checked={rule.checked} onChange={(e) => setSelected({ ...selected, [product.id]: { ...rule, checked: e.target.checked } })} /><span>{product.name} · PKR {Number(product.price).toLocaleString("en-PK")}{activeProductIds.has(product.id) ? " · already discounted" : !product.active ? " · inactive" : ""}</span></label>
            <select aria-label={`${product.name} discount type`} className={input} disabled={!rule.checked || busy} value={rule.kind} onChange={(e) => setSelected({ ...selected, [product.id]: { ...rule, kind: e.target.value } })}><option value="PERCENT">Percent</option><option value="FIXED">PKR off</option></select>
            <input aria-label={`${product.name} discount value`} className={input} type="number" min="0.01" max={rule.kind === "PERCENT" ? 99 : product.price - 0.01} step="0.01" disabled={!rule.checked || busy} value={rule.value} onChange={(e) => setSelected({ ...selected, [product.id]: { ...rule, value: e.target.value } })} />
            <span className="text-xs text-slate-500">{rule.kind === "PERCENT" ? "% off" : "PKR off"}</span>
          </div>;
        })}
      </div>
      <button type="button" className="mt-4 rounded-xl border-0 bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={save}>{busy ? "Saving…" : "Create campaign"}</button>
      {error && <p role="alert" className="text-rose-700">{error}</p>}{notice && <p role="status" className="text-emerald-700">{notice}</p>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">{campaigns.map((campaign) => <article key={campaign.id} className="rounded-2xl border border-solid border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><h3 className="m-0 text-lg font-bold">{campaign.name}</h3><span>{campaign.enabled ? "Active" : "Disabled"}</span></div><ul className="my-3 grid gap-2 pl-5 text-sm">{campaign.products.map((p) => <li key={p.productId}>{p.productName}: {p.kind === "PERCENT" ? `${Number(p.value)}%` : `PKR ${Number(p.value).toLocaleString("en-PK")}`} off · PKR {Number(p.price).toLocaleString("en-PK")}</li>)}</ul><button type="button" disabled={busy} onClick={() => toggle(campaign)} className="rounded-xl border-0 bg-violet-100 px-4 py-2 font-bold text-violet-800">{campaign.enabled ? "Disable campaign" : "Enable campaign"}</button></article>)}</div>
  </section>;
}
