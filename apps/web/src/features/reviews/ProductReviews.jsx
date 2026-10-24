import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/useSession";
import { useLanguage } from "../language/useLanguage";
import {
  getProductReviews,
  getReviewEligibility,
  submitProductReview,
} from "../../api/reviews";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

export default function ProductReviews({ productId }) {
  const { session } = useSession();
  const { language, direction } = useLanguage();
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);
  const locale = urdu ? "ur-PK" : "en-PK";
  const token = session?.accessToken;

  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    const eligibilityRequest = token
      ? getReviewEligibility(productId, token, controller.signal).catch(
          (error) => ({
            canReview: false,
            reason: error.message,
            checkFailed: true,
          }),
        )
      : Promise.resolve({
          canReview: false,
          reason: "Sign in to check whether you can review this product.",
        });

    Promise.all([
      getProductReviews(productId, page, controller.signal),
      eligibilityRequest,
    ])
      .then(([data, eligibility]) => {
        if (!controller.signal.aborted) {
          setResult({
            productId,
            token,
            page,
            reload,
            data,
            eligibility,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            productId,
            token,
            page,
            reload,
            data: null,
            eligibility: null,
            error: error.message || "Could not load reviews.",
          });
        }
      });

    return () => controller.abort();
  }, [productId, token, page, reload]);

  const current =
    result?.productId === productId &&
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload;

  const loading = !current;
  const data = current ? result.data : null;
  const eligibility = current ? result.eligibility : null;
  const error = current ? result.error : "";

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current || !token || !eligibility?.canReview) return;

    if (!comment.trim()) {
      setSubmitError({ type: "validation" });
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFeedback("");
    setSubmitError(null);

    try {
      await submitProductReview(productId, token, {
        rating: Number(rating),
        comment: comment.trim(),
      });

      setComment("");
      setRating("5");
      setPage(0);
      setReload((current) => current + 1);
      setFeedback("submitted");
    } catch (error) {
      setSubmitError({
        type: "request",
        message: error.message || "Could not submit your review.",
      });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const submitErrorText = !submitError
    ? ""
    : submitError.type === "validation"
      ? text("Please write your review.", "براہ کرم اپنا تبصرہ لکھیں۔")
      : text(
          submitError.message,
          "تبصرہ جمع نہیں ہو سکا۔ ریفریش کرکے اپنی اہلیت چیک کریں یا دوبارہ سائن اِن کریں۔",
        );

  return (
    <section
      dir={direction}
      aria-labelledby="reviews-title"
      className="border-0 border-t border-solid border-slate-200 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="reviews-title" className="m-0 text-xl font-bold">
          {text("Ratings & reviews", "درجہ بندی اور تبصرے")}
        </h3>

        <button
          type="button"
          disabled={loading || submitting}
          onClick={() => setReload((current) => current + 1)}
          className={buttonStyle}
        >
          {text("Refresh", "ریفریش")}
        </button>
      </div>

      {data && data.totalItems > 0 && (
        <div className="mt-4 rounded-2xl bg-violet-50 p-4">
          <span className="text-3xl font-extrabold text-violet-700">
            <bdi>{Number(data.averageRating).toFixed(1)}</bdi>
          </span>

          <span className="ms-2 text-sm text-slate-500">
            <bdi>/ 5</bdi> · {data.totalItems}{" "}
            {text(data.totalItems === 1 ? "review" : "reviews", "تبصرے")}
          </span>
        </div>
      )}

      <p role="status" className="text-sm text-violet-700 empty:hidden">
        {feedback === "submitted"
          ? text("Your review was submitted.", "آپ کا تبصرہ جمع ہو گیا ہے۔")
          : ""}
      </p>

      <div className="mt-4" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            {text("Loading reviews…", "تبصرے لوڈ ہو رہے ہیں…")}
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-rose-700">
            {text(
              error,
              "تبصرے لوڈ نہیں ہو سکے۔ ریفریش کرکے دوبارہ کوشش کریں۔",
            )}
          </p>
        ) : data?.items.length ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {data.items.map((review) => (
              <li
                key={review.id}
                className="rounded-2xl border border-solid border-slate-200 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="min-w-0 break-words text-sm">
                    <bdi>{review.authorName}</bdi>
                  </strong>

                  <span
                    aria-label={text(
                      `${review.rating} out of 5 stars`,
                      `5 میں سے ${review.rating} ستارے`,
                    )}
                    className="text-amber-500"
                  >
                    <span aria-hidden="true" dir="ltr">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </span>
                  </span>
                </div>

                {review.verifiedPurchase && (
                  <p className="mb-0 mt-1 text-xs text-emerald-700">
                    {text("Verified purchase", "تصدیق شدہ خریداری")}
                  </p>
                )}

                <p
                  dir="auto"
                  className="mb-2 mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600"
                >
                  {review.comment}
                </p>

                <time
                  dateTime={review.createdAt}
                  className="text-xs text-slate-400"
                >
                  {new Date(review.createdAt).toLocaleDateString(locale)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            {text(
              "No reviews yet for this product.",
              "اس مصنوع کے لیے ابھی کوئی تبصرہ موجود نہیں۔",
            )}
          </p>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <nav
          aria-label={text("Review pages", "تبصروں کے صفحات")}
          className="mt-4 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={page === 0 || submitting}
            onClick={() => setPage((current) => current - 1)}
            className={buttonStyle}
          >
            {text("← Previous", "→ پچھلا")}
          </button>

          <span className="text-xs text-slate-500">
            <bdi>
              {page + 1} / {data.totalPages}
            </bdi>
          </span>

          <button
            type="button"
            disabled={page + 1 >= data.totalPages || submitting}
            onClick={() => setPage((current) => current + 1)}
            className={buttonStyle}
          >
            {text("Next →", "اگلا ←")}
          </button>
        </nav>
      )}

      {!loading &&
        !error &&
        (eligibility?.canReview ? (
          <form onSubmit={handleSubmit} className="mt-5">
            <fieldset
              disabled={submitting}
              className="m-0 grid min-w-0 gap-3 rounded-2xl border border-solid border-violet-100 bg-violet-50 p-4"
            >
              <legend className="px-2 font-semibold">
                {text("Write a review", "تبصرہ لکھیں")}
              </legend>

              <label className="grid gap-2 text-sm font-semibold">
                {text("Rating", "درجہ بندی")}
                <select
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                  className="rounded-xl border border-solid border-slate-200 bg-white p-3"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value}{" "}
                      {text(
                        value === 1 ? "star" : "stars",
                        value === 1 ? "ستارہ" : "ستارے",
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold">
                {text("Your review", "آپ کا تبصرہ")}
                <textarea
                  required
                  dir="auto"
                  rows={3}
                  maxLength={2000}
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                    setSubmitError(null);
                  }}
                  className="box-border w-full resize-y rounded-xl border border-solid border-slate-200 bg-white p-3 font-[inherit]"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
              >
                {submitting
                  ? text("Submitting…", "جمع ہو رہا ہے…")
                  : text("Submit review", "تبصرہ جمع کریں")}
              </button>
            </fieldset>
          </form>
        ) : (
          <div className="mb-0 mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            {!token ? (
              <p className="m-0">
                {text(
                  "Sign in to check whether you can review this product.",
                  "اس مصنوع پر تبصرے کی اہلیت چیک کرنے کے لیے سائن اِن کریں۔",
                )}
              </p>
            ) : (
              <>
                {urdu && (
                  <p className="mb-2 mt-0">
                    {eligibility?.checkFailed
                      ? "تبصرہ لکھنے کی اہلیت چیک نہیں ہو سکی۔ ریفریش کرکے دوبارہ کوشش کریں۔"
                      : "اس وقت تبصرہ جمع کرنے کی اجازت نہیں ہے۔ سرور کی بتائی گئی وجہ:"}
                  </p>
                )}

                <p dir="auto" className="m-0">
                  {eligibility?.reason}
                </p>
              </>
            )}
          </div>
        ))}

      <p role="alert" className="mb-0 text-sm text-rose-700 empty:hidden">
        {submitErrorText}
      </p>
    </section>
  );
}
