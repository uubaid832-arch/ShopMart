package com.shopmart.api.returns;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import com.shopmart.api.notifications.NotificationService;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminReturnService {

  private final JdbcTemplate jdbc;
  private final NotificationService notifications;

  public AdminReturnService(
      JdbcTemplate jdbc,
      NotificationService notifications) {
    this.jdbc = jdbc;
    this.notifications = notifications;
  }

  @Transactional(readOnly = true)
  public ReturnService.Page<ReturnSummary> list(
      UUID adminId, int page, int size) {
    requireAdmin(adminId);

    if (page < 0 || size < 1 || size > 50) {
      throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
    }

    long total = jdbc.queryForObject(
        "SELECT COUNT(*) FROM public.return_requests", Long.class);

    List<ReturnSummary> items = jdbc.query("""
        SELECT r.*, i.order_id, i.product_name, i.quantity,
               o.order_number, o.recipient_name, o.payment_method
        FROM public.return_requests r
        JOIN public.order_items i ON i.id = r.order_item_id
        JOIN public.orders o ON o.id = i.order_id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ? OFFSET ?
        """,
        (rs, row) -> new ReturnSummary(
            rs.getObject("id", UUID.class),
            rs.getObject("order_id", UUID.class),
            rs.getString("order_number"),
            rs.getString("recipient_name"),
            rs.getString("product_name"),
            rs.getInt("quantity"),
            rs.getString("reason"),
            rs.getString("status"),
            rs.getBigDecimal("refund_amount").toPlainString(),
            rs.getString("refund_status"),
            rs.getString("payment_method"),
            rs.getTimestamp("created_at").toInstant()),
        size, (long) page * size);

    return new ReturnService.Page<>(
        items, page, size, total,
        (int) ((total + size - 1) / size));
  }

  @Transactional
  public void updateStatus(
      UUID adminId, UUID requestId, StatusRequest request) {
    requireAdmin(adminId);

    List<UUID> orderIds = jdbc.query("""
        SELECT i.order_id
        FROM public.return_requests r
        JOIN public.order_items i ON i.id = r.order_item_id
        WHERE r.id = ?
        """,
        (rs, row) -> rs.getObject("order_id", UUID.class),
        requestId);

    if (orderIds.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Return request not found.");
    }

    UUID orderId = orderIds.get(0);

    jdbc.queryForList("""
        SELECT id FROM public.orders
        WHERE id = ?
        FOR UPDATE
        """, orderId);

    String current = jdbc.queryForObject("""
        SELECT status
        FROM public.return_requests
        WHERE id = ?
        FOR UPDATE
        """, String.class, requestId);

    String next = request.status();

    if (next.equals(current))
      return;

    boolean allowed = switch (current) {
      case "PENDING" ->
        next.equals("APPROVED") || next.equals("REJECTED");
      case "APPROVED" -> next.equals("RECEIVED");
      default -> false;
    };

    if (!allowed) {
      throw failure(
          HttpStatus.CONFLICT,
          "This return status change is not allowed.");
    }

    if (next.equals("RECEIVED")) {
      jdbc.update("""
          UPDATE public.return_requests
          SET status = 'RECEIVED',
              received_by = ?,
              received_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          """, adminId, requestId);

      Boolean allReceived = jdbc.queryForObject("""
          SELECT NOT EXISTS (
              SELECT 1
              FROM public.order_items i
              WHERE i.order_id = ?
                AND NOT EXISTS (
                    SELECT 1
                    FROM public.return_requests r
                    WHERE r.order_item_id = i.id
                      AND r.status = 'RECEIVED'
                )
          )
          """, Boolean.class, orderId);

      if (Boolean.TRUE.equals(allReceived)) {
        int changed = jdbc.update("""
            UPDATE public.orders
            SET status = 'RETURNED',
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'DELIVERED'
            """, orderId);

        if (changed == 1) {
          jdbc.update("""
              INSERT INTO public.order_status_history (
                  order_id, status, changed_by
              )
              VALUES (?, 'RETURNED', ?)
              """, orderId, adminId);

          notifications.orderStatusChanged(orderId, "RETURNED");
        }
      }
    } else {
      jdbc.update("""
          UPDATE public.return_requests
          SET status = ?,
              reviewed_by = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          """, next, adminId, requestId);
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
      throw failure(
          HttpStatus.FORBIDDEN, "Administrator access is required.");
    }
  }

  private static ResponseStatusException failure(
      HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }

  public record StatusRequest(
      @NotBlank @Pattern(regexp = "APPROVED|REJECTED|RECEIVED") String status) {
  }

  public record ReturnSummary(
      UUID id,
      UUID orderId,
      String orderNumber,
      String customerName,
      String productName,
      int quantity,
      String reason,
      String status,
      String refundAmount,
      String refundStatus,
      String paymentMethod,
      Instant createdAt) {
  }
}