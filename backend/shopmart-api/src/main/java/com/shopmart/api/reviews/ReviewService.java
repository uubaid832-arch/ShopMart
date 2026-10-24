package com.shopmart.api.reviews;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.*;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReviewService {

  private final JdbcTemplate jdbc;

  public ReviewService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public ReviewPage list(UUID productId, int page, int size) {
    requireProduct(productId);

    if (page < 0 || size < 1 || size > 50) {
      throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
    }

    var totals = jdbc.queryForMap("""
        SELECT COUNT(*) AS total,
               COALESCE(AVG(rating), 0) AS average
        FROM public.product_reviews
        WHERE product_id = ? AND is_visible = TRUE
        """, productId);

    long total = ((Number) totals.get("total")).longValue();

    List<ReviewResponse> items = jdbc.query("""
        SELECT r.id, u.name, r.rating, r.comment, r.created_at
        FROM public.product_reviews r
        JOIN public.users u ON u.id = r.user_id
        WHERE r.product_id = ? AND r.is_visible = TRUE
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ? OFFSET ?
        """,
        (rs, row) -> new ReviewResponse(
            rs.getObject("id", UUID.class),
            rs.getString("name"),
            rs.getInt("rating"),
            rs.getString("comment"),
            true,
            rs.getTimestamp("created_at").toInstant()),
        productId, size, (long) page * size);

    return new ReviewPage(
        items,
        page,
        size,
        total,
        (int) ((total + size - 1) / size),
        ((Number) totals.get("average")).doubleValue());
  }

  @Transactional(readOnly = true)
  public Eligibility eligibility(UUID userId, UUID productId) {
    requireProduct(productId);

    var users = jdbc.queryForList("""
        SELECT enabled, role
        FROM public.users
        WHERE id = ?
        """, userId);

    if (users.isEmpty()
        || !Boolean.TRUE.equals(users.get(0).get("enabled"))) {
      throw failure(HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }

    if (!"CUSTOMER".equals(users.get(0).get("role"))) {
      return new Eligibility(false, "Reviews are available to customer accounts.");
    }

    Boolean reviewed = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.product_reviews
            WHERE product_id = ? AND user_id = ?
        )
        """, Boolean.class, productId, userId);

    if (Boolean.TRUE.equals(reviewed)) {
      return new Eligibility(false, "You have already reviewed this product.");
    }

    Boolean purchased = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1
            FROM public.orders o
            JOIN public.order_items i ON i.order_id = o.id
            WHERE o.user_id = ?
              AND i.product_id = ?
              AND EXISTS (
                  SELECT 1
                  FROM public.order_status_history h
                  WHERE h.order_id = o.id AND h.status = 'DELIVERED'
              )
        )
        """, Boolean.class, userId, productId);

    return Boolean.TRUE.equals(purchased)
        ? new Eligibility(true, "")
        : new Eligibility(
            false, "You can review this product after receiving your order.");
  }

  @Transactional
  public UUID create(UUID userId, UUID productId, ReviewRequest request) {
    // Serialize review submissions from the same account.
    jdbc.queryForList("""
        SELECT id FROM public.users
        WHERE id = ?
        FOR UPDATE
        """, userId);

    Eligibility eligibility = eligibility(userId, productId);

    if (!eligibility.canReview()) {
      throw failure(HttpStatus.CONFLICT, eligibility.reason());
    }

    String comment = request.comment().strip();

    if (comment.isBlank()) {
      throw failure(HttpStatus.BAD_REQUEST, "Please write your review.");
    }

    UUID id = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.product_reviews (
            id, product_id, user_id, rating, comment
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        id,
        productId,
        userId,
        request.rating(),
        comment);

    return id;
  }

  private void requireProduct(UUID productId) {
    Boolean exists = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.products WHERE id = ?
        )
        """, Boolean.class, productId);

    if (!Boolean.TRUE.equals(exists)) {
      throw failure(HttpStatus.NOT_FOUND, "Product not found.");
    }
  }

  private static ResponseStatusException failure(
      HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }

  public record ReviewRequest(
      @NotNull @Min(1) @Max(5) Integer rating,
      @NotBlank @Size(max = 2000) String comment) {
  }

  public record Eligibility(boolean canReview, String reason) {
  }

  public record ReviewResponse(
      UUID id,
      String authorName,
      int rating,
      String comment,
      boolean verifiedPurchase,
      Instant createdAt) {
  }

  public record ReviewPage(
      List<ReviewResponse> items,
      int page,
      int size,
      long totalItems,
      int totalPages,
      double averageRating) {
  }
}