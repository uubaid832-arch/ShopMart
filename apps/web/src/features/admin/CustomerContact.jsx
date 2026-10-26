import { useEffect, useState } from "react";
import { getAdminOrder } from "../../api/adminOrders";
import { useSession } from "../auth/useSession";
import { customerContactUrl, customerMessage } from "./contactMessages";
const input = "box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3 text-sm";
const button = "rounded-xl border-0 bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-700 disabled:opacity-40";
export default function CustomerContact({ token, item, mode = "delivery" }) {
  const { session } = useSession();
  const addressKey = `shopmart.admin.warehouse-address.${session.user.id}`;
  const [refundChoice, setRefundChoice] = useState("ACCOUNT");
  const [expanded, setExpanded] = useState(false);
  const [model, setModel] = useState(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [warehouse, setWarehouse] = useState(() => {
    try { return localStorage.getItem(addressKey) || ""; } catch { return ""; }
  });
  const [error, setError] = useState("");
  const orderId = item.orderId || item.id;
  const needsWarehouse = mode === "return" && item.status !== "REJECTED";
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    getAdminOrder(token, orderId, controller.signal).then(order => {
      if (controller.signal.aborted) return;
      setModel(order); setEmail(order.delivery?.email || ""); setPhone(order.delivery?.phone || "");
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [token, orderId, expanded]);
  let preview = "";
  if (model && (!needsWarehouse || warehouse.trim().length >= 10)) preview = customerMessage({ mode, orderNumber: model.orderNumber, customerName: model.delivery?.name, productName: item.productName, returnId: item.id, status: item.status, warehouse, refundChoice, rejectionReason: item.rejectionReason });
  function compose(channel) {
    try {
      if (!preview) throw new Error("Enter the full warehouse address first.");
      if (needsWarehouse) localStorage.setItem(addressKey, warehouse.trim());
      const url = customerContactUrl(channel, channel === "email" ? email : phone, `ShopMart ${mode === "refund" ? "refund preference" : mode === "return" ? "return instructions" : "delivery verification"} — ${model.orderNumber}`, preview);
      setError("");
      if (channel === "whatsapp") window.open(url, "_blank", "noopener,noreferrer");
      else window.location.href = url;
    } catch (e) { setError(e.message); }
  }
  return <section className="my-3 rounded-xl border border-solid border-violet-100 bg-violet-50/40 p-4">
    <button type="button" className={button} onClick={() => setExpanded(v => !v)}>{expanded ? "Close contact draft" : mode === "refund" ? "Contact customer · refund details / voucher" : mode === "return" ? "Contact customer · return instructions" : "Contact customer · Email / WhatsApp"}</button>
    {expanded && <div className="mt-4 grid gap-3">
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!model ? <p role="status">Loading customer details…</p> : <>
        <label className="grid gap-1 text-sm">Customer email<input className={input} type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">WhatsApp number<input className={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
        {needsWarehouse && <label className="grid gap-1 text-sm">Warehouse return address, city and contact<textarea className={input} maxLength={1500} rows={3} value={warehouse} onChange={e => setWarehouse(e.target.value)} /></label>}
        {needsWarehouse && <button type="button" className={button} onClick={() => { try { if (warehouse.trim().length < 10) throw new Error("Enter the complete warehouse address."); localStorage.setItem(addressKey, warehouse.trim()); setError(""); } catch (e) { setError(e.message); } }}>Save warehouse address for new requests</button>}
        {mode === "refund" && <label className="grid gap-1 text-sm">Refund follow-up<select className={input} value={refundChoice} onChange={e => setRefundChoice(e.target.value)}><option value="ACCOUNT">Ask preference and account details</option><option value="VOUCHER">Offer a future purchase voucher</option></select></label>}
        {preview && <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 font-sans text-sm leading-6">{preview}</pre>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!preview} className={button} onClick={() => compose("email")}>Email customer</button><button type="button" disabled={!preview} className={button} onClick={() => compose("whatsapp")}>WhatsApp customer</button></div>
        <p className="m-0 text-xs text-slate-500">Review and send the draft in your email or WhatsApp app. Editing the recipient here does not update delivery details. Confirm instructions sent only after sending the message.</p>
      </>}
    </div>}
  </section>;
}
