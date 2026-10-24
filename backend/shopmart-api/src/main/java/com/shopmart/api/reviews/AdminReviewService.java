package com.shopmart.api.reviews;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminReviewService {

  private final JdbcTemplate jdbc;

  public AdminReviewService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public ReviewPage list(UUID adminId, int page, int size) {
    requireAdmin(adminId);

    if (page < 0 || size < 1 || size > 50) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Invalid pagination.");
    }

    long total = jdbc.queryForObject(
        "SELECT COUNT(*) FROM public.product_reviews", Long.class);

    List<ReviewResponse> items = jdbc.query("""
        SELECT r.id, r.product_id, p.name AS product_name,
               u.name AS author_name, r.rating, r.comment,
               r.is_visible, r.created_at
        FROM public.product_reviews r
        JOIN public.products p ON p.id = r.product_id
        JOIN public.users u ON u.id = r.user_id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ? OFFSET ?
        """,
        (rs, row) -> new ReviewResponse(
            rs.getObject("id", UUID.class),
            rs.getObject("product_id", UUID.class),
            rs.getString("product_name"),
            rs.getString("author_name"),
            rs.getInt("rating"),
            rs.getString("comment"),
            rs.getBoolean("is_visible"),
            rs.getTimestamp("created_at").toInstant()),
        size, (long) page * size);

    return new ReviewPage(
        items, page, size, total,
        (int) ((total + size - 1) / size));
  }

  @Transactional
  public void updateVisibility(
      UUID adminId, UUID id, VisibilityRequest request) {
    requireAdmin(adminId);

    int updated = jdbc.update("""
        UPDATE public.product_reviews
        SET is_visible = ?
        WHERE id = ?
        """, request.visible(), id);

    if (updated == 0) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Review not found.");
    }
  }

  private void requireAdmin(UUID userId) {
    Boolean allowed = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = ? AND enabled = TRUE AND role = 'ADMIN'
        )
        """, Boolean.class, userId);

    if (!Boolean.TRUE.equals(allowed)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Administrator access is required.");
    }
  }

  public record VisibilityRequest(@NotNull Boolean visible) {
  }

  public record ReviewResponse(
      UUID id,
      UUID productId,
      String productName,
      String authorName,
      int rating,
      String comment,
      boolean visible,
      Instant createdAt) {
  }

  public record ReviewPage(
      List<ReviewResponse> items,
      int page,
      int size,
      long totalItems,
      int totalPages) {
  }
}