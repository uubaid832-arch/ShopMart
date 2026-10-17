import { useState } from "react";

export default function ProductReviews({
  reviews = [],
  loading = false,
  error = "",
  canReview = false,
  onSubmitReview,
}) {
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canReview || !onSubmitReview || submitting) return;

    if (!comment.trim()) {
      setFeedback("Please write your review.");
      return;
    }

    setSubmitting(true);
    setFeedback("");

    try {
      await onSubmitReview({
        rating: Number(rating),
        comment: comment.trim(),
      });
      setComment("");
      setFeedback("Your review was submitted.");
    } catch {
      setFeedback("Could not submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="reviews-title"
      className="border-0 border-t border-solid border-slate-200 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="reviews-title" className="m-0 text-xl font-bold">
          Ratings & reviews
        </h3>

        {!loading && !error && average !== null && (
          <span className="text-sm font-semibold text-violet-700">
            {average.toFixed(1)} / 5 · {reviews.length} reviews
          </span>
        )}
      </div>

      <div className="mt-4" aria-busy={loading}>
        {loading ? (
          <p role="status" className="text-sm text-slate-500">
            Loading reviews…
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            No reviews to display for this product.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-xl border border-solid border-slate-200 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-sm">{review.authorName}</strong>
                  <span
                    aria-label={`${review.rating} out of 5 stars`}
                    className="text-amber-500"
                  >
                    <span aria-hidden="true">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </span>
                  </span>
                </div>

                {review.verifiedPurchase && (
                  <p className="mb-0 mt-1 text-xs text-emerald-700">
                    Verified purchase
                  </p>
                )}

                <p className="mb-2 mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">
                  {review.comment}
                </p>

                <time
                  dateTime={review.createdAt}
                  className="text-xs text-slate-500"
                >
                  {new Date(review.createdAt).toLocaleDateString("en-PK")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canReview && onSubmitReview ? (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
          <fieldset
            disabled={submitting}
            className="m-0 grid min-w-0 gap-3 border-0 p-0"
          >
            <legend className="mb-3 font-semibold">Write a review</legend>

            <label className="grid gap-2 text-sm" htmlFor="review-rating">
              Rating
              <select
                id="review-rating"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
                className="rounded-xl border border-solid border-slate-200 bg-white p-3"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} {value === 1 ? "star" : "stars"}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm" htmlFor="review-comment">
              Your review
              <textarea
                id="review-comment"
                required
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="box-border w-full resize-y rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit]"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl border-0 bg-violet-600 p-3 font-semibold text-white enabled:hover:bg-violet-700"
            >
              {submitting ? "Submitting…" : "Submit review"}
            </button>
          </fieldset>

          <p role="status" className="m-0 text-sm text-violet-700 empty:hidden">
            {feedback}
          </p>
        </form>
      ) : (
        <p className="mb-0 mt-5 rounded-xl bg-violet-50 p-3 text-xs text-slate-600">
          Review submission is currently unavailable.
        </p>
      )}
    </section>
  );
}
