import { useState } from "react";

const sampleReviews = [
  {
    id: "sample-review-1",
    productName: "Wireless Headphones",
    authorName: "Sample Customer",
    rating: 4,
    comment: "Comfortable to wear and easy to use.",
    status: "Pending",
  },
];

export default function AdminReviews() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const filtered = sampleReviews.filter((review) => {
    const matchesSearch =
      `${review.productName} ${review.authorName} ${review.comment}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());

    return matchesSearch && (status === "All" || review.status === status);
  });

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="m-0 text-3xl font-bold">Reviews</h1>
        <p className="mb-0 mt-2 text-sm text-slate-500">
          Review customer feedback before publishing it.
        </p>
      </header>

      <p className="m-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sample review · No customer submitted this feedback. Moderation is not
        connected.
      </p>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <label className="grid gap-2 text-sm font-semibold">
          Search reviews
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product, customer or review text"
            className="w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Moderation status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-solid border-slate-200 bg-white p-3"
          >
            {["All", "Pending", "Published", "Rejected"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" className="m-0 text-sm text-slate-500">
        {filtered.length} reviews found
      </p>

      {filtered.length === 0 ? (
        <p className="m-0 rounded-2xl bg-white p-8 text-center text-slate-500">
          No matching reviews.
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

                <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold">
                  {review.status}
                </span>
              </div>

              <p className="my-3 text-sm font-semibold text-amber-700">
                Rating: {review.rating} / 5
              </p>

              <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
                {review.comment}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {["Publish", "Reject"].map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled
                    className="rounded-xl border-0 bg-slate-100 px-4 py-2 font-semibold text-slate-500"
                  >
                    {action}
                  </button>
                ))}
              </div>

              <p className="mb-0 mt-3 text-xs text-slate-500">
                Moderation actions will be enabled when the backend is
                connected.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
