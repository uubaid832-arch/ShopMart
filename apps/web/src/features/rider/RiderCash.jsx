import { useEffect, useRef, useState } from "react";
import { Wallet, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { useSession } from "../auth/useSession";
import { riderCodRequest } from "../../api/riderCod";
const money = (x) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(
    Number(x || 0),
  );
const button =
  "rounded-xl border-0 bg-violet-100 px-4 py-2.5 text-sm font-semibold text-violet-700 disabled:opacity-40";
export default function RiderCash() {
  const { session } = useSession();
  const token = session.accessToken;
  const [page, setPage] = useState(0),
    [historyPage, setHistoryPage] = useState(0),
    [status, setStatus] = useState("ALL"),
    [reload, setReload] = useState(0);
  const [model, setModel] = useState(null),
    [selected, setSelected] = useState([]),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [detail, setDetail] = useState(null);
  const pending = useRef(false);
  const submission = useRef(null);
  useEffect(() => {
    const c = new AbortController();
    Promise.all([
      riderCodRequest(token, "/dashboard", { signal: c.signal }),
      riderCodRequest(token, `/cod/collections?page=${page}&size=20`, {
        signal: c.signal,
      }),
      riderCodRequest(
        token,
        `/cod/handovers?status=${status}&page=${historyPage}&size=10`,
        { signal: c.signal },
      ),
    ])
      .then(([summary, collections, history]) => {
        if (!c.signal.aborted)
          setModel({
            token,
            page,
            historyPage,
            status,
            reload,
            summary,
            collections,
            history,
          });
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [token, page, historyPage, status, reload]);
  const current =
    model?.token === token &&
    model.page === page &&
    model.historyPage === historyPage &&
    model.status === status &&
    model.reload === reload;
  const data = current ? model : null;
  const items = data?.collections.items || [];
  const amount = items
    .filter((x) => selected.includes(x.id))
    .reduce((sum, x) => sum + Number(x.amount), 0);
  function refresh() {
    setSelected([]);
    setConfirmed(false);
    setDetail(null);
    setReload((v) => v + 1);
  }
  async function report() {
    if (pending.current || !current || !confirmed || !selected.length) return;
    if (
      !window.confirm(
        `Confirm you physically handed ${money(amount)} to the administrator?`,
      )
    )
      return;
    const fingerprint = JSON.stringify({
      ids: [...selected].sort(),
      note: note.trim(),
    });
    const key = `shopmart.cod.report.${session.user.id}`;
    try {
      if (!submission.current) {
        try {
          submission.current = JSON.parse(sessionStorage.getItem(key));
        } catch {
          /* Start a new report if no saved request exists. */
        }
      }
      if (submission.current?.fingerprint !== fingerprint)
        submission.current = { fingerprint, requestId: crypto.randomUUID() };
      sessionStorage.setItem(key, JSON.stringify(submission.current));
    } catch {
      setError(
        "Could not save the report reference. Enable browser storage before submitting.",
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await riderCodRequest(token, "/cod/handovers", {
        values: {
          requestId: submission.current.requestId,
          collectionIds: selected,
          note: note.trim(),
        },
      });
      sessionStorage.removeItem(key);
      submission.current = null;
      setNotice("Handover reported. Waiting for administrator confirmation.");
      setNote("");
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function pages(value, next) {
    return (
      value?.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            className={button}
            disabled={busy || value.page === 0}
            onClick={() => next(value.page - 1)}
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            {value.page + 1} / {value.totalPages}
          </span>
          <button
            className={button}
            disabled={busy || value.page + 1 >= value.totalPages}
            onClick={() => next(value.page + 1)}
          >
            Next
          </button>
        </div>
      )
    );
  }
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-bold tracking-widest text-violet-600">
            RIDER CASH DESK
          </p>
          <h1 className="mb-1 mt-2 text-3xl font-bold">COD handovers</h1>
          <p className="m-0 text-sm text-slate-500">
            Track collected cash and report physical handovers.
          </p>
        </div>
        <button className={button} disabled={busy} onClick={refresh}>
          <RefreshCw size={16} className="mr-2 inline" />
          Refresh
        </button>
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
      {!data ? (
        <p role="status">Loading cash records…</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total collected", data.summary.totalCollected, Wallet],
              [
                "Confirmed handovers",
                data.summary.confirmedHandovers,
                CheckCircle2,
              ],
              ["Awaiting confirmation", data.summary.pendingHandovers, Clock],
              ["Cash outstanding", data.summary.outstandingBalance, Wallet],
            ].map(([label, value, Icon]) => (
              <article
                key={label}
                className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
              >
                <Icon size={19} className="text-violet-600" />
                <p className="text-xs text-slate-500">{label}</p>
                <strong className="text-xl">{money(value)}</strong>
              </article>
            ))}
          </section>
          <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
            <h2 className="mt-0 text-lg font-bold">Report a cash handover</h2>
            <p className="text-sm text-slate-500">
              Select the COD collections you physically handed to the
              administrator. Your balance decreases after confirmation. Safepay
              orders do not collect cash.
            </p>
            {!items.length ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm">
                No unreported collections on this page.
              </p>
            ) : (
              items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 border-0 border-b border-solid border-slate-100 py-4"
                >
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, item.id]
                          : old.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span className="flex-1 text-sm">
                    <b>{item.orderNumber}</b>
                    <small className="mt-1 block text-slate-500">
                      {new Date(item.collectedAt).toLocaleString("en-PK")}
                    </small>
                  </span>
                  <strong>{money(item.amount)}</strong>
                </label>
              ))
            )}
            {pages(data.collections, (p) => {
              setPage(p);
              setSelected([]);
              setConfirmed(false);
            })}
            <textarea
              aria-label="Handover note"
              maxLength={500}
              disabled={busy}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional receipt / handover note"
              className="mt-4 box-border w-full rounded-xl border border-solid border-slate-200 p-3"
            />
            <label className="my-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I physically handed this cash to the administrator.
            </label>
            <button
              className="rounded-xl border-0 bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-40"
              disabled={busy || !confirmed || !selected.length}
              onClick={report}
            >
              {busy ? "Submitting…" : `Report ${money(amount)}`}
            </button>
          </section>
          <section className="rounded-2xl border border-solid border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Handover history</h2>
              <select
                aria-label="Handover status"
                disabled={busy}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setHistoryPage(0);
                }}
                className="rounded-xl border border-solid border-slate-200 p-2"
              >
                {["ALL", "PENDING", "CONFIRMED", "REJECTED"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {!data.history.items.length ? (
              <p className="text-sm text-slate-500">
                No handovers in this section.
              </p>
            ) : (
              data.history.items.map((item) => (
                <article
                  key={item.id}
                  className="border-0 border-b border-solid border-slate-100 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{money(item.amount)}</strong>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : item.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString("en-PK")}
                  </p>
                  {item.decisionNote && (
                    <p className="text-sm">
                      Administrator: {item.decisionNote}
                    </p>
                  )}
                  <button
                    className={button}
                    onClick={async () => {
                      try {
                        setDetail(
                          await riderCodRequest(
                            token,
                            `/cod/handovers/${item.id}`,
                          ),
                        );
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    View included orders
                  </button>
                </article>
              ))
            )}
            {pages(data.history, setHistoryPage)}
            {detail && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <button className={button} onClick={() => setDetail(null)}>
                  Close details
                </button>
                <h3>
                  {money(detail.handover.amount)} · {detail.handover.status}
                </h3>
                {detail.collections.map((c) => (
                  <p key={c.id} className="text-sm">
                    {c.orderNumber} · {money(c.amount)}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
