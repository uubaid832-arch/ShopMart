package com.shopmart.api.returns;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;

import jakarta.validation.constraints.*;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReturnService {

  private final JdbcTemplate jdbc;

  public ReturnService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public Page<EligibleItem> eligible(UUID userId, int page, int size) {
    return eligible(userId, page, size, null);
  }

  @Transactional(readOnly = true)
  public Page<EligibleItem> eligible(UUID userId, int page, int size, UUID orderId) {
    requireUser(userId);
    validatePage(page, size);

    // Keep trailing whitespace: the following SQL text block begins with ORDER BY.
    String orderFilter = orderId == null ? "" : " AND o.id = ? ";
    List<Object> countArgs = new ArrayList<>();
    countArgs.add(userId);
    if (orderId != null) countArgs.add(orderId);

    long total = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM public.order_items i
        JOIN public.orders o ON o.id = i.order_id
        WHERE o.user_id = ?
          AND o.status = 'DELIVERED'
          AND ((o.payment_method = 'COD' AND o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED'))
            OR (o.payment_method = 'DEMO' AND o.payment_status = 'DEMO_PAID'
                AND EXISTS (SELECT 1 FROM public.safepay_sessions sp
                            WHERE sp.order_id = o.id AND sp.state = 'PAID')))
          AND NOT EXISTS (
              SELECT 1 FROM public.return_requests r
              WHERE r.order_item_id = i.id
          )
        """ + orderFilter, Long.class, countArgs.toArray());

    List<Object> itemArgs = new ArrayList<>(countArgs);
    itemArgs.add(size);
    itemArgs.add((long) page * size);

    List<EligibleItem> items = jdbc.query("""
        SELECT i.id, i.order_id, i.product_name, i.quantity,
               o.order_number, o.created_at
        FROM public.order_items i
        JOIN public.orders o ON o.id = i.order_id
        WHERE o.user_id = ?
          AND o.status = 'DELIVERED'
          AND ((o.payment_method = 'COD' AND o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED'))
            OR (o.payment_method = 'DEMO' AND o.payment_status = 'DEMO_PAID'
                AND EXISTS (SELECT 1 FROM public.safepay_sessions sp
                            WHERE sp.order_id = o.id AND sp.state = 'PAID')))
          AND NOT EXISTS (
              SELECT 1 FROM public.return_requests r
              WHERE r.order_item_id = i.id
          )
        """ + orderFilter + """
        ORDER BY o.created_at DESC, i.id
        LIMIT ? OFFSET ?
        """,
        (rs, row) -> new EligibleItem(
            rs.getObject("id", UUID.class),
            rs.getObject("order_id", UUID.class),
            rs.getString("order_number"),
            rs.getString("product_name"),
            rs.getInt("quantity"),
            rs.getTimestamp("created_at").toInstant()),
        itemArgs.toArray());

    return new Page<>(
        items, page, size, total, totalPages(total, size));
  }

  @Transactional(readOnly = true)
  public Page<ReturnResponse> list(UUID userId, int page, int size) {
    return list(userId, page, size, null);
  }

  @Transactional(readOnly = true)
  public Page<ReturnResponse> list(UUID userId, int page, int size, UUID orderId) {
    requireUser(userId);
    validatePage(page, size);

    // Keep trailing whitespace: the following SQL text block begins with ORDER BY.
    String orderFilter = orderId == null ? "" : " AND o.id = ? ";
    List<Object> countArgs = new ArrayList<>();
    countArgs.add(userId);
    if (orderId != null) countArgs.add(orderId);

    long total = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM public.return_requests r
        JOIN public.order_items i ON i.id = r.order_item_id
        JOIN public.orders o ON o.id = i.order_id
        WHERE o.user_id = ?
        """ + orderFilter, Long.class, countArgs.toArray());

    List<Object> itemArgs = new ArrayList<>(countArgs);
    itemArgs.add(size);
    itemArgs.add((long) page * size);

    List<ReturnResponse> items = jdbc.query("""
        SELECT r.*, i.order_id, i.product_name, i.quantity,
               o.order_number
        FROM public.return_requests r
        JOIN public.order_items i ON i.id = r.order_item_id
        JOIN public.orders o ON o.id = i.order_id
        WHERE o.user_id = ?
        """ + orderFilter + """
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ? OFFSET ?
        """,
        (rs, row) -> new ReturnResponse(
            rs.getObject("id", UUID.class),
            rs.getObject("order_id", UUID.class),
            rs.getObject("order_item_id", UUID.class),
            rs.getString("order_number"),
            rs.getString("product_name"),
            rs.getInt("quantity"),
            rs.getString("reason"),
            rs.getString("status"),
            rs.getBigDecimal("refund_amount").toPlainString(),
            rs.getString("refund_status"),
            rs.getTimestamp("created_at").toInstant(), rs.getString("rejection_reason")),
        itemArgs.toArray());

    return new Page<>(
        items, page, size, total, totalPages(total, size));
  }

  @Transactional
  public UUID create(UUID userId, CreateReturnRequest request) {
    requireUser(userId);

    String reason = request.reason().strip();

    if (reason.isBlank()) {
      throw failure(HttpStatus.BAD_REQUEST, "Enter a return reason.");
    }

    var orders = jdbc.queryForList("""
        SELECT status, payment_status, payment_method
        FROM public.orders
        WHERE id = ? AND user_id = ?
        FOR UPDATE
        """, request.orderId(), userId);

    if (orders.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Order not found.");
    }

    var order = orders.get(0);

    boolean paidCod = "COD".equals(order.get("payment_method"))
        && java.util.Set.of("PAID", "PARTIALLY_REFUNDED").contains(order.get("payment_status"));
    boolean verifiedSafepay = "DEMO".equals(order.get("payment_method"))
        && "DEMO_PAID".equals(order.get("payment_status"))
        && Boolean.TRUE.equals(jdbc.queryForObject("""
            SELECT EXISTS (SELECT 1 FROM public.safepay_sessions
                           WHERE order_id = ? AND state = 'PAID')
            """, Boolean.class, request.orderId()));
    if (!"DELIVERED".equals(order.get("status")) || !(paidCod || verifiedSafepay)) {
      throw failure(
          HttpStatus.CONFLICT,
          "Only delivered paid COD or verified Safepay orders are eligible for return.");
    }

    var items = jdbc.queryForList("""
        SELECT unit_price, quantity, discount_amount
        FROM public.order_items
        WHERE id = ? AND order_id = ?
        """, request.orderItemId(), request.orderId());

    if (items.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Order item not found.");
    }

    Boolean exists = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.return_requests
            WHERE order_item_id = ?
        )
        """, Boolean.class, request.orderItemId());

    if (Boolean.TRUE.equals(exists)) {
      throw failure(
          HttpStatus.CONFLICT,
          "A return request already exists for this item.");
    }

    var item = items.get(0);

    BigDecimal amount = ((BigDecimal) item.get("unit_price"))
        .multiply(BigDecimal.valueOf(
            ((Number) item.get("quantity")).longValue()))
        .subtract((BigDecimal)item.get("discount_amount"));

    UUID id = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO public.return_requests (
            id, order_item_id, reason, refund_amount
        )
        VALUES (?, ?, ?, ?)
        """, id, request.orderItemId(), reason, amount);

    return id;
  }

  private void requireUser(UUID userId) {
    Boolean enabled = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = ? AND enabled = TRUE
        )
        """, Boolean.class, userId);

    if (!Boolean.TRUE.equals(enabled)) {
      throw failure(HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }
  }

  private static void validatePage(int page, int size) {
    if (page < 0 || size < 1 || size > 50) {
      throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
    }
  }

  private static int totalPages(long total, int size) {
    return (int) ((total + size - 1) / size);
  }

  private static ResponseStatusException failure(
      HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }

  public record CreateReturnRequest(
      @NotNull UUID orderId,
      @NotNull UUID orderItemId,
      @NotBlank @Size(max = 1000) String reason) {
  }

  public record EligibleItem(
      UUID orderItemId,
      UUID orderId,
      String orderNumber,
      String productName,
      int quantity,
      Instant createdAt) {
  }

  public record ReturnResponse(
      UUID id,
      UUID orderId,
      UUID orderItemId,
      String orderNumber,
      String productName,
      int quantity,
      String reason,
      String status,
      String refundAmount,
      String refundStatus,
      Instant createdAt, String rejectionReason) {
    public ReturnResponse(UUID id, UUID orderId, UUID orderItemId, String orderNumber, String productName,
        int quantity, String reason, String status, String refundAmount, String refundStatus, Instant createdAt) {
      this(id,orderId,orderItemId,orderNumber,productName,quantity,reason,status,refundAmount,refundStatus,createdAt,null);
    }
  }

  public record Page<T>(
      List<T> items,
      int page,
      int size,
      long totalItems,
      int totalPages) {
  }
}
