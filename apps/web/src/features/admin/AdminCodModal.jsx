import { useEffect, useRef, useState } from "react";
import { Wallet, CheckCircle2, XCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Modal from "../../components/Modal";
import { adminCodRequest } from "../../api/cod";
const money=value=>new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR"}).format(Number(value||0));
const button="rounded-xl border-0 bg-violet-100 px-4 py-3 text-sm font-semibold text-violet-700 disabled:opacity-40";

export default function AdminCodModal({token,onClose}){
  const [status,setStatus]=useState("PENDING");
  const [page,setPage]=useState(0);
  const [reload,setReload]=useState(0);
  const [result,setResult]=useState(null);
  const [selected,setSelected]=useState(null);
  const [detail,setDetail]=useState(null);
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const pending=useRef(false);
  useEffect(()=>{
    if(!token)return;
    const controller=new AbortController();
    adminCodRequest(token,`?status=${status}&page=${page}&size=20`,undefined,controller.signal)
      .then(data=>{if(!controller.signal.aborted){const last=Math.max(0,data.totalPages-1);if(page>last){setPage(last);return;}setResult({token,status,page,reload,data,error:""});}})
      .catch(failure=>{if(!controller.signal.aborted)setResult({token,status,page,reload,error:failure.message});});
    return()=>controller.abort();
  },[token,status,page,reload]);
  useEffect(()=>{
    if(!selected||!token)return;
    const controller=new AbortController();
    adminCodRequest(token,`/${selected}`,undefined,controller.signal)
      .then(data=>{if(!controller.signal.aborted)setDetail({token,id:selected,reload,data,error:""});})
      .catch(failure=>{if(!controller.signal.aborted)setDetail({token,id:selected,reload,error:failure.message});});
    return()=>controller.abort();
  },[token,selected,reload]);
  const current=result?.token===token&&result?.status===status&&result?.page===page&&result?.reload===reload;
  const detailCurrent=detail?.token===token&&detail?.id===selected&&detail?.reload===reload;
  const record=detailCurrent?detail.data?.handover:null;
  function close(){if(!pending.current)onClose();}
  async function decide(next){
    if(pending.current||!record||record.status!=="PENDING")return;
    if(next==="REJECTED"&&!note.trim()){setError("Explain the discrepancy before rejecting this report.");return;}
    if(!window.confirm(next==="CONFIRMED"?`Confirm you physically received ${money(record.amount)} from ${record.riderName}? This reduces their outstanding COD balance.`:"Reject this handover? Its collections will become available for the rider to report again."))return;
    pending.current=true;setBusy(true);setError("");setNotice("");
    try{
      await adminCodRequest(token,`/${record.id}`,{status:next,note:note.trim()});
      setSelected(null);setNote("");setNotice(next==="CONFIRMED"?"Cash receipt confirmed. The rider's outstanding balance has been updated.":"Handover rejected. The rider has been notified.");
    }catch(failure){setError(failure.message);}
    finally{pending.current=false;setBusy(false);setReload(v=>v+1);}
  }
  return <Modal onClose={close} labelledBy="cod-title" size="lg" fixedSections>
    <header className="flex items-center justify-between gap-3 bg-violet-50 p-5"><div><p className="m-0 text-xs font-bold tracking-widest text-violet-500">CASH RECONCILIATION</p><h2 id="cod-title" className="mb-0 mt-2 flex items-center gap-2 text-2xl font-bold"><Wallet size={24}/>COD handovers</h2></div><button type="button" disabled={busy} onClick={close} className={button}>Close</button></header>
    <div className="min-h-0 overflow-y-auto p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {selected?<button type="button" disabled={busy} onClick={()=>{setSelected(null);setNote("");setError("");}} className={`${button} flex items-center gap-2`}><ArrowLeft size={16}/>Reports</button>:<select aria-label="Handover status" value={status} disabled={busy} onChange={e=>{setStatus(e.target.value);setPage(0);setError("");}} className="rounded-xl border border-solid border-slate-200 bg-white p-3 text-sm">{["PENDING","CONFIRMED","REJECTED","ALL"].map(value=><option key={value} value={value}>{value}</option>)}</select>}
        <button type="button" aria-label="Refresh handovers" disabled={busy} onClick={()=>setReload(v=>v+1)} className={button}><RefreshCw size={17}/></button>
      </div>
      {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {selected?(!detailCurrent?<p className="text-sm text-slate-500">Loading report...</p>:detail.error?<p role="alert" className="text-rose-700">{detail.error}</p>:<>
        <div className="rounded-2xl bg-violet-50 p-5"><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{record.status}</span><h3 className="mb-2 text-xl">{record.riderName}</h3><p className="my-2 text-3xl font-bold text-violet-700">{money(record.amount)}</p><p className="text-xs text-slate-500">Reported {new Date(record.createdAt).toLocaleString("en-PK")}</p>{record.note&&<p className="whitespace-pre-wrap break-words text-sm text-slate-600">Rider note: {record.note}</p>}</div>
        <h3 className="mt-6 text-base">Included COD collections</h3><ul className="grid list-none gap-3 p-0">{detail.data.collections.map(item=><li key={item.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-solid border-slate-200 p-4"><div><strong className="text-sm">{item.orderNumber}</strong><p className="mb-0 text-xs text-slate-500">Collected {new Date(item.collectedAt).toLocaleString("en-PK")}</p></div><strong className="text-violet-700">{money(item.amount)}</strong></li>)}</ul>
        {record.status==="PENDING"?<><label className="mt-5 grid gap-2 text-sm font-semibold">Administrator note (required for rejection)<textarea value={note} onChange={e=>setNote(e.target.value)} disabled={busy} maxLength={500} rows={3} className="rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit]"/></label><p className="text-xs leading-5 text-slate-500">Confirm only after counting the cash physically received. A report by the rider is not proof of receipt.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={()=>decide("CONFIRMED")} className="flex items-center gap-2 rounded-xl border-0 bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-40"><CheckCircle2 size={18}/>{busy?"Updating...":"Confirm cash received"}</button><button type="button" disabled={busy} onClick={()=>decide("REJECTED")} className="flex items-center gap-2 rounded-xl border-0 bg-rose-100 px-4 py-3 font-semibold text-rose-700 disabled:opacity-40"><XCircle size={18}/>Reject report</button></div></>:<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p>Reviewed by {record.adminName} · {record.decidedAt?new Date(record.decidedAt).toLocaleString("en-PK"):""}</p>{record.decisionNote&&<p className="whitespace-pre-wrap break-words">{record.decisionNote}</p>}</div>}
      </>):!current?<p className="text-sm text-slate-500">Loading handovers...</p>:result.error?<p role="alert" className="text-rose-700">{result.error}</p>:<>
        {!result.data.items.length&&<p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No reports with this status.</p>}
        <div className="grid gap-3">{result.data.items.map(item=><button key={item.id} type="button" onClick={()=>{setSelected(item.id);setNote("");setError("");}} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-solid border-slate-200 bg-white p-4 text-left hover:border-violet-300"><div><strong className="text-sm">{item.riderName}</strong><p className="mb-0 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-PK")} · {item.status}</p></div><strong className="text-xl text-violet-700">{money(item.amount)}</strong></button>)}</div>
        {result.data.totalPages>1&&<div className="mt-5 flex items-center justify-between"><button type="button" disabled={page===0} onClick={()=>setPage(v=>v-1)} className={button}>Previous</button><span className="text-xs text-slate-500">{page+1} / {result.data.totalPages}</span><button type="button" disabled={page+1>=result.data.totalPages} onClick={()=>setPage(v=>v+1)} className={button}>Next</button></div>}
      </>}
    </div>
  </Modal>;
}
