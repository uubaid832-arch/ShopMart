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
  const [editing, setEditing] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
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
    if (!chosen.length) { setError("Choose at least one product for this campaign."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await voucherRequest(token, editing ? `/admin/product-discounts/${editing.id}` : "/admin/product-discounts", { method: editing ? "PUT" : "POST", values: {
        ...(editing ? { version: editing.version } : { requestId: crypto.randomUUID() }),
        name: name.trim() || null,
        products: chosen.map(([productId, value]) => ({ productId, kind: value.kind, value: Number(value.value) })),
      } });
      setName(""); setSelected({}); setEditing(null); setNotice(editing ? "Promotion updated." : "Automatic discount campaign created."); setRevision((v) => v + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  function startEdit(campaign) {
    setEditing(campaign);
    setName(campaign.name || "");
    setSelected(Object.fromEntries(campaign.products.map((product) => [product.productId, { checked: true, kind: product.kind, value: String(product.value) }])));
    setError(""); setNotice("");
  }
  function cancelEdit() { setEditing(null); setName(""); setSelected({}); setError(""); }
  async function toggle(campaign) {
    setBusy(true); setError(""); setNotice("");
    try {
      await voucherRequest(token, `/admin/product-discounts/${campaign.id}`, { method: "PATCH", values: { enabled: !campaign.enabled, version: campaign.version } });
      setNotice(`Campaign ${campaign.enabled ? "disabled" : "enabled"}.`); setRevision((v) => v + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function deleteCampaign(campaign) {
    if (!window.confirm(`Permanently delete disabled promotion ${campaign.name || "Unnamed sale promotion"}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await voucherRequest(token, `/admin/product-discounts/${campaign.id}`, { method: "DELETE" });
      setNotice("Disabled promotion deleted."); setRevision((v) => v + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-5">
    <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
      <h2 className="m-0 text-xl font-extrabold">{editing ? "Edit promotion" : "Automatic product discount"}</h2>
      <p className="text-sm text-slate-600">Choose products and set a separate percentage or PKR discount for each. Discounted products are excluded from voucher codes.</p>
      <label className="grid gap-2 text-sm font-semibold">Campaign name (optional)<input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Leave blank for a general sale label" /></label>
      <label className="mt-4 grid gap-2 text-sm font-semibold">Find products<input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" /></label>
      <div className="mt-4 grid max-h-96 gap-2 overflow-auto">
        {visibleProducts.map((product) => {
          const belongsToEditing = editing?.products.some((item) => item.productId === product.id);
          const locked = (activeProductIds.has(product.id) && !belongsToEditing) || !product.active;
          const rule = selected[product.id] ?? { checked: false, kind: "PERCENT", value: "10" };
          return <div key={product.id} className="grid gap-2 rounded-xl border border-solid border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <label className="flex items-center gap-2"><input type="checkbox" disabled={locked || busy} checked={rule.checked} onChange={(e) => setSelected({ ...selected, [product.id]: { ...rule, checked: e.target.checked } })} /><span>{product.name} · PKR {Number(product.price).toLocaleString("en-PK")}{activeProductIds.has(product.id) ? " · already discounted" : !product.active ? " · inactive" : ""}</span></label>
            <select aria-label={`${product.name} discount type`} className={input} disabled={!rule.checked || busy} value={rule.kind} onChange={(e) => setSelected({ ...selected, [product.id]: { ...rule, kind: e.target.value } })}><option value="PERCENT">Percent</option><option value="FIXED">PKR off</option></select>
            <input aria-label={`${product.name} discount value`} className={input} type="number" min="0.01" max={rule.kind === "PERCENT" ? 99 : product.price - 0.01} step="0.01" disabled={!rule.checked || busy} value={rule.value} onChange={(e) => setSelected({ ...selected, [product.id]: { ...rule, value: e.target.value } })} />
            <span className="text-xs text-slate-500">{rule.kind === "PERCENT" ? "% off" : "PKR off"}</span>
          </div>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="rounded-xl border-0 bg-violet-600 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={busy} onClick={save}>{busy ? "Saving…" : editing ? "Save promotion" : "Create campaign"}</button>{editing && <button type="button" className="rounded-xl border border-solid border-slate-300 bg-white px-5 py-3 font-bold text-slate-700" disabled={busy} onClick={cancelEdit}>Cancel edit</button>}</div>
      {error && <p role="alert" className="text-rose-700">{error}</p>}{notice && <p role="status" className="text-emerald-700">{notice}</p>}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">{campaigns.map((campaign) => <article key={campaign.id} className="rounded-2xl border border-solid border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><h3 className="m-0 text-lg font-bold">{campaign.name || "Unnamed sale promotion"}</h3><span>{campaign.enabled ? "Active" : "Disabled"}</span></div><p className="my-3 text-sm text-slate-600">{campaign.products.length} included products</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)} className="rounded-xl border border-solid border-slate-300 bg-white px-4 py-2 font-bold text-slate-700">{expandedId === campaign.id ? "Hide included products" : "Show included products"}</button><button type="button" disabled={busy} onClick={() => startEdit(campaign)} className="rounded-xl border border-solid border-violet-200 bg-white px-4 py-2 font-bold text-violet-800">Edit promotion</button><button type="button" disabled={busy} onClick={() => toggle(campaign)} className="rounded-xl border-0 bg-violet-100 px-4 py-2 font-bold text-violet-800">{campaign.enabled ? "Disable campaign" : "Enable campaign"}</button>{!campaign.enabled && <button type="button" disabled={busy} onClick={() => deleteCampaign(campaign)} className="rounded-xl border-0 bg-rose-100 px-4 py-2 font-bold text-rose-700">Delete campaign</button>}</div>{expandedId === campaign.id && <ul className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 ps-8 text-sm">{campaign.products.map((p) => <li key={p.productId}>{p.productName}: {p.kind === "PERCENT" ? `${Number(p.value)}%` : `PKR ${Number(p.value).toLocaleString("en-PK")}`} off · Original PKR {Number(p.price).toLocaleString("en-PK")}</li>)}</ul>}</article>)}</div>
  </section>;
}
