import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

async function request(productId, path = "", token, values, signal) {
  const response = await fetch(
    `${baseUrl}/api/mobile/products/${encodeURIComponent(productId)}/reviews${path}`,
    {
      method: values ? "POST" : "GET",
      credentials: "omit",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(values && { "Content-Type": "application/json" }),
      },
      body: values ? JSON.stringify(values) : undefined,
      signal,
    },
  );

  if (!response.ok) {
    const messages = {
      400: "Choose a rating and write a review of up to 2,000 characters.",
      401: "Your session has expired. Please sign in again.",
      403: "You do not have permission to submit this review.",
      404: "Product not found.",
      409: "You already reviewed this product or are not eligible.",
    };

    throw new Error(
      messages[response.status] ||
        "Could not complete the request. Refresh before trying again.",
    );
  }

  return response.json();
}

function stars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export default function ProductReviews({ productId, session }) {
  const token = session?.accessToken;
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [reviews, eligibility] = await Promise.all([
          request(
            productId,
            `?page=${page}&size=5`,
            undefined,
            undefined,
            controller.signal,
          ),
          token
            ? request(
                productId,
                "/eligibility",
                token,
                undefined,
                controller.signal,
              ).catch((failure) => ({
                canReview: false,
                reason: failure.message,
              }))
            : Promise.resolve({
                canReview: false,
                reason: "Sign in to check whether you can review this product.",
              }),
        ]);

        if (!controller.signal.aborted) {
          setResult({
            productId,
            token,
            page,
            reload,
            reviews,
            eligibility,
            error: "",
          });
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setResult({
            productId,
            token,
            page,
            reload,
            error: failure.message,
          });
        }
      }
    }

    load();
    return () => controller.abort();
  }, [productId, token, page, reload]);

  const current =
    result?.productId === productId &&
    result?.token === token &&
    result?.page === page &&
    result?.reload === reload;

  async function submit() {
    if (pending.current || !current || !result.eligibility?.canReview) return;

    if (!rating || !comment.trim()) {
      setError("Choose a star rating and write your review.");
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await request(productId, "", token, {
        rating,
        comment: comment.trim(),
      });

      setRating(0);
      setComment("");
      setNotice("Your review was submitted.");
      setPage(0);
      setReload((value) => value + 1);
    } catch (failure) {
      setError(failure.message);
      // Refresh eligibility in case a previous request was accepted.
      setReload((value) => value + 1);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Ratings & reviews</Text>

        <Pressable
          accessibilityRole="button"
          disabled={busy || !current}
          onPress={() => setReload((value) => value + 1)}
          style={styles.refresh}
        >
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {!current ? (
        <ActivityIndicator color="#7c3aed" style={styles.loader} />
      ) : result.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {result.error}
        </Text>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.average}>
              {Number(result.reviews.averageRating || 0).toFixed(1)}
              <Text style={styles.outOf}> / 5</Text>
            </Text>
            <Text style={styles.muted}>
              {result.reviews.totalItems} review(s)
            </Text>
          </View>

          {result.eligibility.canReview ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Share your experience</Text>

              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${value} out of 5`}
                    accessibilityState={{ selected: rating === value }}
                    disabled={busy}
                    onPress={() => setRating(value)}
                    style={styles.starButton}
                  >
                    <Text style={styles.star}>
                      {value <= rating ? "★" : "☆"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                accessibilityLabel="Your product review"
                placeholder="What did you like about this product?"
                placeholderTextColor="#94a3b8"
                value={comment}
                onChangeText={setComment}
                editable={!busy}
                multiline
                maxLength={2000}
                textAlignVertical="top"
                style={styles.input}
              />

              <Text style={styles.counter}>{comment.length}/2000</Text>

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={submit}
                style={[styles.submit, busy && styles.disabled]}
              >
                <Text style={styles.submitText}>
                  {busy ? "Submitting..." : "Submit review"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.reason}>{result.eligibility.reason}</Text>
          )}

          {result.reviews.items.length === 0 ? (
            <Text style={styles.muted}>No reviews yet.</Text>
          ) : (
            result.reviews.items.map((review) => (
              <View key={review.id} style={styles.review}>
                <Text style={styles.author}>{review.authorName}</Text>
                <Text
                  accessibilityLabel={`${review.rating} out of 5 stars`}
                  style={styles.reviewStars}
                >
                  {stars(review.rating)}
                </Text>

                {review.verifiedPurchase && (
                  <Text style={styles.verified}>✓ Verified purchase</Text>
                )}

                <Text style={styles.comment}>{review.comment}</Text>
                <Text style={styles.muted}>
                  {new Date(review.createdAt).toLocaleDateString("en-PK")}
                </Text>
              </View>
            ))
          )}

          {result.reviews.totalPages > 1 && (
            <View style={styles.pagination}>
              <Pressable
                accessibilityRole="button"
                disabled={busy || page === 0}
                onPress={() => setPage((value) => value - 1)}
                style={styles.refresh}
              >
                <Text style={styles.link}>Previous</Text>
              </Pressable>

              <Text style={styles.muted}>
                {page + 1} / {result.reviews.totalPages}
              </Text>

              <Pressable
                accessibilityRole="button"
                disabled={busy || page + 1 >= result.reviews.totalPages}
                onPress={() => setPage((value) => value + 1)}
                style={styles.refresh}
              >
                <Text style={styles.link}>Next</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 30,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  refresh: { padding: 12 },
  link: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },
  loader: { marginVertical: 24 },
  summary: {
    backgroundColor: "#f5f3ff",
    padding: 18,
    borderRadius: 16,
    marginVertical: 16,
  },
  average: { fontSize: 32, fontWeight: "800", color: "#7c3aed" },
  outOf: { fontSize: 16, color: "#94a3b8" },
  muted: { color: "#64748b", fontSize: 12, marginTop: 7 },
  reason: { color: "#64748b", lineHeight: 22, marginBottom: 20 },
  form: {
    padding: 16,
    backgroundColor: "#faf8ff",
    borderRadius: 16,
    marginBottom: 20,
  },
  formTitle: { fontWeight: "700", color: "#334155", fontSize: 15 },
  stars: { flexDirection: "row", marginVertical: 10 },
  starButton: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  star: { fontSize: 31, color: "#d97706" },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    color: "#334155",
    fontSize: 14,
  },
  counter: { textAlign: "right", color: "#94a3b8", marginTop: 6, fontSize: 11 },
  submit: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  submitText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.5 },
  review: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 18,
  },
  author: { fontWeight: "700", color: "#0f172a", fontSize: 14 },
  reviewStars: { color: "#d97706", fontSize: 20, marginTop: 5 },
  verified: { color: "#15803d", fontSize: 11, marginTop: 5 },
  comment: { color: "#475569", lineHeight: 23, marginTop: 10 },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  error: { color: "#be123c", lineHeight: 22, marginVertical: 12 },
  notice: { color: "#15803d", lineHeight: 22, marginVertical: 12 },
});
