package com.shopmart.api.admin;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import com.shopmart.api.notifications.NotificationService;
import com.shopmart.api.orders.OrderModels.OrderReceipt;
import com.shopmart.api.orders.OrderService;
import com.shopmart.api.orders.OrderPaymentRules;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminOrderService {

  private final JdbcTemplate jdbc;
  private final OrderService orders;
  private final NotificationService notifications;

  public AdminOrderService(
      JdbcTemplate jdbc,
      OrderService orders,
      NotificationService notifications) {
    this.jdbc = jdbc;
    this.orders = orders;
    this.notifications = notifications;
  }

  @Transactional(readOnly = true)
  public OrderPage list(UUID adminId, int page, int size) {
    requireAdmin(adminId);

    if (page < 0 || size < 1 || size > 50) {
      throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
    }

    long total = jdbc.queryForObject(
        "SELECT COUNT(*) FROM public.orders", Long.class);

    List<OrderSummary> items = jdbc.query("""
        SELECT o.id, o.order_number, u.name AS customer_name,
               o.status, o.payment_method, o.payment_status,
               o.total, o.currency, o.created_at
        FROM public.orders o
        JOIN public.users u ON u.id = o.user_id
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ? OFFSET ?
        """,
        (rs, row) -> new OrderSummary(
            rs.getObject("id", UUID.class),
            rs.getString("order_number"),
            rs.getString("customer_name"),
            rs.getString("status"),
            rs.getString("payment_method"),
            rs.getString("payment_status"),
            rs.getBigDecimal("total").toPlainString(),
            rs.getString("currency"),
            rs.getTimestamp("created_at").toInstant()),
        size, (long) page * size);

    return new OrderPage(
        items, page, size, total,
        (int) ((total + size - 1) / size));
  }

  @Transactional(readOnly = true)
  public OrderReceipt get(UUID adminId, UUID orderId) {
    requireAdmin(adminId);

    List<UUID> owners = jdbc.query("""
        SELECT user_id
        FROM public.orders
        WHERE id = ?
        """,
        (rs, row) -> rs.getObject("user_id", UUID.class),
        orderId);

    if (owners.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Order not found.");
    }

    return orders.getOrder(owners.get(0), orderId);
  }

  @Transactional
  public OrderReceipt updateStatus(
      UUID adminId,
      UUID orderId,
      StatusRequest request) {
    requireAdmin(adminId);

    String next = request.status();

    if ("DELIVERED".equals(next)) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Only the assigned rider can confirm delivery and cash collection.");
    }

    if (next == null
        || !Set.of("CONFIRMED", "DISPATCHED", "CANCELLED").contains(next)) {
      throw failure(HttpStatus.BAD_REQUEST, "Invalid order status.");
    }

    var matches = jdbc.queryForList("""
        SELECT user_id, status, payment_method, payment_status
                FROM public.orders
                WHERE id = ?
                FOR UPDATE
                """, orderId);

    if (matches.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Order not found.");
    }

    var order = matches.get(0);
    String current = (String) order.get("status");
    UUID customerId = (UUID) order.get("user_id");

    if (current.equals(next)) {
      return orders.getOrder(customerId, orderId);
    }

    boolean allowed = switch (current) {
      case "PENDING" ->
        next.equals("CONFIRMED") || next.equals("CANCELLED");
      case "CONFIRMED" ->
        next.equals("DISPATCHED") || next.equals("CANCELLED");
      default -> false;
    };

    if (!allowed) {
      throw failure(
          HttpStatus.CONFLICT,
          "This order status change is not allowed.");
    }
    if (!OrderPaymentRules.supportsDelivery(order)) {
      throw failure(
          HttpStatus.CONFLICT,
          "This order does not have a supported payment state.");
    }
    if (next.equals("DISPATCHED")) {
      var assignedRiders = jdbc.queryForList("""
          SELECT u.id
          FROM public.delivery_assignments a
          JOIN public.users u ON u.id = a.rider_id
          WHERE a.order_id = ?
            AND u.role = 'RIDER'
            AND u.enabled = TRUE
          FOR SHARE OF u
          """, orderId);

      if (assignedRiders.isEmpty()) {
        throw failure(
            HttpStatus.CONFLICT,
            "Assign an enabled rider before dispatching this order.");
      }
    }

    if (next.equals("CANCELLED")) {
      var items = jdbc.queryForList("""
          SELECT product_id, quantity
          FROM public.order_items
          WHERE order_id = ?
          ORDER BY product_id
          """, orderId);

      for (var item : items) {
        int updated = jdbc.update("""
            UPDATE public.products
            SET stock = stock + ?,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            item.get("quantity"),
            item.get("product_id"));

        if (updated != 1) {
          throw failure(
              HttpStatus.CONFLICT, "Could not restore product stock.");
        }
      }
    }

    jdbc.update("""
        UPDATE public.orders
        SET status = ?,
            payment_status = CASE
                WHEN payment_method = 'DEMO' AND ? = 'CANCELLED'
                    THEN 'DEMO_VOID'
                ELSE payment_status
            END,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, next, next, orderId);
    jdbc.update("""
        INSERT INTO public.order_status_history (
            order_id, status, changed_by
        )
        VALUES (?, ?, ?)
        """, orderId, next, adminId);

    notifications.orderStatusChanged(orderId, next);

    return orders.getOrder(customerId, orderId);
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
      @NotBlank @Pattern(regexp = "CONFIRMED|DISPATCHED|CANCELLED") String status) {
  }

  public record OrderSummary(
      UUID id,
      String orderNumber,
      String customerName,
      String status,
      String paymentMethod,
      String paymentStatus,
      String total,
      String currency,
      Instant createdAt) {
  }

  public record OrderPage(
      List<OrderSummary> items,
      int page,
      int size,
      long totalItems,
      int totalPages) {
  }
}