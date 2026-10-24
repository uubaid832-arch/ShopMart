import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/useSession";
import {
  getAdminUsers,
  createRider,
  updateUserEnabled,
} from "../../api/adminUsers";
import RiderForm from "./RiderForm";
import ResetRiderPasswordModal from "./ResetRiderPasswordModal";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-50";

const inputStyle =
  "box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3 text-sm text-slate-800";

const accountTypes = [
  { value: "CUSTOMER", label: "Customers", singular: "customer" },
  { value: "RIDER", label: "Riders", singular: "rider" },
  { value: "ADMIN", label: "Administrators", singular: "administrator" },
];

export default function AdminUsers() {
  const { session } = useSession();
  const token = session.accessToken;

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("CUSTOMER");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [resetRider, setResetRider] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");

  const inFlight = useRef(false);

  const requestKey = JSON.stringify([token, page, size, query, role, reload]);

  useEffect(() => {
    const controller = new AbortController();

    getAdminUsers(token, { page, size, search: query, role }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data: null,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, page, size, query, role, reload, requestKey]);

  const current = result?.key === requestKey;
  const loading = !current;
  const data = current ? result.data : null;
  const error = current ? result.error : "";
  const busy = Boolean(savingId);

  const accountType =
    accountTypes.find((type) => type.value === role) ?? accountTypes[0];

  const first = data?.totalItems ? page * size + 1 : 0;
  const last = data ? page * size + data.items.length : 0;

  function selectRole(value) {
    if (inFlight.current) return;

    setRole(value);
    setPage(0);
    setSearch("");
    setQuery("");
    setFeedback("");
    setActionError("");
  }

  async function toggleEnabled(user) {
    if (inFlight.current || user.role === "ADMIN") return;

    const action = user.enabled ? "Disable" : "Enable";

    if (!window.confirm(`${action} the account for "${user.name}"?`)) {
      return;
    }

    inFlight.current = true;
    setSavingId(user.id);
    setFeedback("");
    setActionError("");

    try {
      await updateUserEnabled(token, user);

      setFeedback(
        `${user.name}'s account ${user.enabled ? "disabled" : "enabled"}.`,
      );
    } catch (failure) {
      setActionError(failure.message);
    } finally {
      inFlight.current = false;
      setSavingId(null);
      setReload((value) => value + 1);
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-3xl font-bold">Users & riders</h1>

          <p className="mb-0 mt-2 text-sm text-slate-500">
            Manage customer access and delivery rider accounts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => setReload((value) => value + 1)}
            className={buttonStyle}
          >
            Refresh
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setActionError("");
              setFeedback("");
              setFormOpen(true);
            }}
            className="rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
          >
            + Create rider
          </button>
        </div>
      </header>

      <div
        role="group"
        aria-label="Account type"
        className="flex flex-wrap gap-2 rounded-2xl border border-solid border-slate-200 bg-white p-3"
      >
        {accountTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            aria-pressed={role === type.value}
            disabled={busy}
            onClick={() => selectRole(type.value)}
            className={`rounded-xl border-0 px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${
              role === type.value
                ? "bg-violet-600 text-white"
                : "bg-slate-100 text-slate-600 enabled:hover:bg-violet-50 enabled:hover:text-violet-700"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (inFlight.current) return;

          setPage(0);
          setQuery(search.trim());
        }}
        className="grid items-end gap-3 sm:grid-cols-[1fr_auto]"
      >
        <label className="grid gap-2 text-sm font-semibold">
          Search {accountType.label.toLowerCase()}
          <input
            type="search"
            value={search}
            maxLength={150}
            disabled={busy}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or phone"
            className={inputStyle}
          />
        </label>

        <button type="submit" disabled={busy} className={`${buttonStyle} py-3`}>
          Search
        </button>
      </form>

      {feedback && (
        <p
          role="status"
          className="m-0 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {feedback}
        </p>
      )}

      {actionError && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
        >
          {actionError}
        </p>
      )}

      <section
        aria-labelledby="account-table-title"
        aria-busy={loading}
        className="overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white"
      >
        <header className="border-0 border-b border-solid border-slate-200 p-5">
          <h2 id="account-table-title" className="m-0 text-lg font-bold">
            {accountType.label}
          </h2>

          <p className="mb-0 mt-2 text-xs leading-5 text-slate-500">
            {role === "RIDER"
              ? "Manage rider access and reset rider passwords. Riders with active deliveries cannot be disabled."
              : role === "ADMIN"
                ? "Administrator accounts are protected and cannot be changed here."
                : "Enable or disable customer accounts while preserving their order history."}
          </p>
        </header>

        {loading ? (
          <p role="status" className="m-0 p-6 text-slate-500">
            Loading {accountType.label.toLowerCase()}…
          </p>
        ) : error ? (
          <p role="alert" className="m-0 p-6 text-rose-700">
            {error}
          </p>
        ) : !data?.items.length ? (
          <p className="m-0 p-8 text-center text-slate-500">
            No matching {accountType.label.toLowerCase()}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                ShopMart {accountType.label.toLowerCase()}
              </caption>

              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Name / Email", "Phone", "Status", "Actions"].map(
                    (label) => (
                      <th key={label} scope="col" className="p-4 font-semibold">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {data.items.map((user) => (
                  <tr
                    key={user.id}
                    className="border-0 border-t border-solid border-slate-200"
                  >
                    <td className="p-4">
                      <p className="m-0 font-semibold">{user.name}</p>

                      <p className="mb-0 mt-1 break-all text-xs text-slate-500">
                        {user.email}
                      </p>
                    </td>

                    <td className="whitespace-nowrap p-4">
                      {user.phone || "Not provided"}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${
                          user.enabled
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {user.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>

                    <td className="p-4">
                      {user.role === "ADMIN" ? (
                        <span className="text-xs text-slate-500">
                          Protected account
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleEnabled(user)}
                            aria-label={`${
                              user.enabled ? "Disable" : "Enable"
                            } ${user.name}`}
                            className={`rounded-lg border-0 px-3 py-2 font-semibold disabled:opacity-50 ${
                              user.enabled
                                ? "bg-rose-50 text-rose-700 enabled:hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-700 enabled:hover:bg-emerald-100"
                            }`}
                          >
                            {savingId === user.id
                              ? "Updating…"
                              : user.enabled
                                ? "Disable"
                                : "Enable"}
                          </button>

                          {role === "RIDER" && user.role === "RIDER" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setActionError("");
                                setFeedback("");
                                setResetRider(user);
                              }}
                              aria-label={`Reset password for ${user.name}`}
                              className="rounded-lg border-0 bg-violet-50 px-3 py-2 font-semibold text-violet-700 enabled:hover:bg-violet-100 disabled:opacity-50"
                            >
                              Reset password
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data && !error && (
        <nav
          aria-label={`${accountType.label} pagination`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-solid border-slate-200 bg-white p-4"
        >
          <p className="m-0 text-sm text-slate-500">
            Showing {first}–{last} of {data.totalItems}{" "}
            {data.totalItems === 1
              ? accountType.singular
              : accountType.label.toLowerCase()}
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-500">
            Per page
            <select
              value={size}
              disabled={busy}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
              className="rounded-lg border border-solid border-slate-200 bg-white p-2 text-slate-800"
            >
              {[10, 20, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={page === 0 || busy}
              onClick={() => setPage((value) => value - 1)}
              className={buttonStyle}
            >
              ← Previous
            </button>

            <span className="text-xs text-slate-500">
              {data.totalPages ? page + 1 : 0} / {data.totalPages}
            </span>

            <button
              type="button"
              disabled={page + 1 >= data.totalPages || busy}
              onClick={() => setPage((value) => value + 1)}
              className={buttonStyle}
            >
              Next →
            </button>
          </div>
        </nav>
      )}

      {formOpen && (
        <RiderForm
          onSave={async (values) => {
            await createRider(token, values);
            setRole("RIDER");
            setSearch("");
            setQuery("");
            setPage(0);
            setFeedback("Rider account created successfully.");
            setActionError("");
            setReload((value) => value + 1);
          }}
          onClose={() => setFormOpen(false)}
        />
      )}

      {resetRider && (
        <ResetRiderPasswordModal
          key={resetRider.id}
          rider={resetRider}
          accessToken={token}
          onSaved={() => {
            setFeedback(`Password reset for ${resetRider.name}.`);
            setActionError("");
            setReload((value) => value + 1);
          }}
          onClose={() => setResetRider(null)}
        />
      )}
    </div>
  );
}
