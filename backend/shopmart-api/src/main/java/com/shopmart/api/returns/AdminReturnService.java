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
            rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("instructions_sent_at") == null ? null : rs.getTimestamp("instructions_sent_at").toInstant(),
            rs.getString("rejection_reason")),
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

    var saved = jdbc.queryForMap("""
        SELECT status, instructions_sent_at, rejection_reason FROM public.return_requests
        WHERE id=? FOR UPDATE
        """, requestId);
    String current = (String) saved.get("status");
    String next = request.status();
    String reason = request.rejectionReason() == null ? "" : request.rejectionReason().strip();
    if ("CONTACTED".equals(next)) {
      if (!"PENDING".equals(current)) throw failure(HttpStatus.CONFLICT, "Instructions can only be recorded for a new return.");
      if (saved.get("instructions_sent_at") != null) return;
      jdbc.update("""
          UPDATE public.return_requests SET instructions_sent_by=?, instructions_sent_at=CURRENT_TIMESTAMP,
            updated_at=CURRENT_TIMESTAMP WHERE id=?
          """, adminId, requestId);
      return;
    }
    if (next.equals(current)) {
      if ("REJECTED".equals(next) && !reason.equals(saved.get("rejection_reason")))
        throw failure(HttpStatus.CONFLICT, "This return already has a recorded rejection reason.");
      return;
    }
    boolean allowed = ("PENDING".equals(current) && "RECEIVED".equals(next) && saved.get("instructions_sent_at") != null)
        || ("RECEIVED".equals(current) && java.util.Set.of("APPROVED", "REJECTED").contains(next));
    if (!allowed) throw failure(HttpStatus.CONFLICT, "Send return instructions, confirm physical receipt, then accept or reject after inspection.");
    if ("REJECTED".equals(next) && (reason.isBlank() || reason.length()>1000))
      throw failure(HttpStatus.BAD_REQUEST, "Enter a rejection reason of up to 1000 characters.");
    if ("RECEIVED".equals(next)) {
      jdbc.update("""
          UPDATE public.return_requests SET status='RECEIVED', received_by=?, received_at=CURRENT_TIMESTAMP,
            updated_at=CURRENT_TIMESTAMP WHERE id=?
          """, adminId, requestId);
      return;
    }
    jdbc.update("""
        UPDATE public.return_requests SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP,
          rejection_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
        """, next, adminId, "REJECTED".equals(next) ? reason : null, requestId);
    // Physical receipt alone is not acceptance. Only accepted goods contribute to a fully returned order.
    if ("APPROVED".equals(next)) {
      Boolean allAccepted = jdbc.queryForObject("""
          SELECT NOT EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id=? AND NOT EXISTS (
            SELECT 1 FROM public.return_requests r WHERE r.order_item_id=i.id AND r.status='APPROVED'))
          """, Boolean.class, orderId);
      if (Boolean.TRUE.equals(allAccepted)) {
        int changed = jdbc.update("""
            UPDATE public.orders SET status='RETURNED', version=version+1, updated_at=CURRENT_TIMESTAMP
            WHERE id=? AND status='DELIVERED'
            """, orderId);
        if (changed==1) {
          jdbc.update("INSERT INTO public.order_status_history(order_id,status,changed_by) VALUES(?,'RETURNED',?)", orderId, adminId);
          notifications.orderStatusChanged(orderId, "RETURNED");
        }
      }
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
      @NotBlank @Pattern(regexp = "CONTACTED|APPROVED|REJECTED|RECEIVED") String status,
      @jakarta.validation.constraints.Size(max=1000) String rejectionReason) {
    public StatusRequest(String status) { this(status, null); }
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
      Instant createdAt, Instant instructionsSentAt, String rejectionReason) {
    public ReturnSummary(UUID id, UUID orderId, String orderNumber, String customerName, String productName,
        int quantity, String reason, String status, String refundAmount, String refundStatus, String paymentMethod, Instant createdAt) {
      this(id,orderId,orderNumber,customerName,productName,quantity,reason,status,refundAmount,refundStatus,paymentMethod,createdAt,null,null);
    }
  }
}