import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/useSession";
import { getAdminReviews, setReviewVisibility } from "../../api/adminReviews";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

export default function AdminReviews() {
  const { session } = useSession();
  const token = session.accessToken;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    getAdminReviews(token, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ token, page, reload, data, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            page,
            reload,
            data: null,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, page, reload]);

  const current =
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload;

  const loading = !current;
  const data = current ? result.data : null;
  const error = current ? result.error : "";
  const query = search.trim().toLowerCase();

  const filtered = (data?.items ?? []).filter((review) => {
    const matchesSearch =
      `${review.productName} ${review.authorName} ${review.comment}`
        .toLowerCase()
        .includes(query);

    const matchesStatus =
      status === "All" ||
      (status === "Published" && review.visible) ||
      (status === "Hidden" && !review.visible);

    return matchesSearch && matchesStatus;
  });

  async function toggleVisibility(review) {
    if (inFlight.current) return;

    inFlight.current = true;
    setSavingId(review.id);
    setFeedback("");
    setActionError("");

    try {
      await setReviewVisibility(token, review.id, !review.visible);
      setFeedback(review.visible ? "Review hidden." : "Review restored.");
      setReload((current) => current + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      inFlight.current = false;
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-3xl font-bold">Reviews</h1>
          <p className="mb-0 mt-2 text-sm text-slate-500">
            Manage customer feedback. Hidden reviews do not affect public
            ratings.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || Boolean(savingId)}
          onClick={() => setReload((current) => current + 1)}
          className={buttonStyle}
        >
          Refresh
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <label className="grid gap-2 text-sm font-semibold">
          Search this page
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product, customer or review"
            className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Visibility on this page
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-solid border-slate-200 bg-white p-3"
          >
            {["All", "Published", "Hidden"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {feedback && (
        <p role="status" className="m-0 text-sm text-emerald-700">
          {feedback}
        </p>
      )}

      {actionError && (
        <p role="alert" className="m-0 text-sm text-rose-700">
          {actionError}
        </p>
      )}

      <section aria-label="Customer reviews" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading reviews…
          </p>
        ) : error ? (
          <p role="alert" className="text-rose-700">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
            No matching reviews on this page.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {filtered.map((review) => (
              <li
                key={review.id}
                className="rounded-2xl border border-solid border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-lg font-bold">
                      {review.productName}
                    </h2>
                    <p className="mb-0 mt-1 text-sm text-slate-500">
                      By {review.authorName}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      review.visible
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {review.visible ? "Published" : "Hidden"}
                  </span>
                </div>

                <p
                  aria-label={`${review.rating} out of 5 stars`}
                  className="my-3 text-amber-500"
                >
                  <span aria-hidden="true">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </p>

                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {review.comment}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <time
                    dateTime={review.createdAt}
                    className="text-xs text-slate-400"
                  >
                    {new Date(review.createdAt).toLocaleDateString("en-PK")}
                  </time>

                  <button
                    type="button"
                    disabled={Boolean(savingId)}
                    onClick={() => toggleVisibility(review)}
                    className={`rounded-xl border-0 px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                      review.visible
                        ? "bg-rose-50 text-rose-700 enabled:hover:bg-rose-100"
                        : "bg-violet-600 text-white enabled:hover:bg-violet-700"
                    }`}
                  >
                    {savingId === review.id
                      ? "Updating…"
                      : review.visible
                        ? "Hide review"
                        : "Restore review"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && data.totalPages > 1 && (
        <nav
          aria-label="Review pages"
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={page === 0 || Boolean(savingId)}
            onClick={() => setPage((current) => current - 1)}
            className={buttonStyle}
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            {page + 1} / {data.totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= data.totalPages || Boolean(savingId)}
            onClick={() => setPage((current) => current + 1)}
            className={buttonStyle}
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
