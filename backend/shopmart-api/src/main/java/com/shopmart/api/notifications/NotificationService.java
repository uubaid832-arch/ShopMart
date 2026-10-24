package com.shopmart.api.notifications;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NotificationService {

  private final JdbcTemplate jdbc;

  public NotificationService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void orderPlaced(UUID customerId, UUID orderId, String number) {
    send(customerId, "CUSTOMER_ORDER_PLACED:" + orderId, "ORDER_PLACED",
        "Order placed", "Your order " + number + " has been placed.", orderId);
    notifyAdmins("ADMIN_NEW_ORDER:" + orderId, "NEW_ORDER", "New order received",
        "A new order " + number + " is ready for review.", orderId);
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void deliveryAssigned(UUID orderId, UUID riderId, UUID previousRiderId) {
    var order = jdbc.queryForMap("""
        SELECT order_number, status FROM public.orders WHERE id = ?
        """, orderId);
    String number = (String) order.get("order_number");
    boolean dispatched = "DISPATCHED".equals(order.get("status"));
    String event = UUID.randomUUID().toString();
    send(riderId, "RIDER_ASSIGNED:" + event, "DELIVERY_ASSIGNED", "New delivery assigned",
        "Order " + number + " has been assigned to you. "
            + (dispatched ? "It is already dispatched." : "Wait for dispatch before delivering."),
        orderId);
    if (previousRiderId != null && !previousRiderId.equals(riderId)) {
      send(previousRiderId, "RIDER_REASSIGNED:" + event, "DELIVERY_REASSIGNED",
          "Delivery reassigned", "Order " + number + " has been assigned to another rider.", orderId);
    }
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void orderStatusChanged(UUID orderId, String status) {
    var order = jdbc.queryForMap("""
        SELECT user_id, order_number, version FROM public.orders WHERE id = ?
        """, orderId);
    UUID customerId = (UUID) order.get("user_id");
    String number = (String) order.get("order_number");

    // Each status write increments the order version. This also handles
    // multiple delivery cycles and repeated calls for the same update.
    String key = orderId + ":" + status + ":" + order.get("version");

    String message = switch (status) {
      case "CONFIRMED" -> "has been confirmed.";
      case "DISPATCHED" -> "is out for delivery.";
      case "DELIVERED" -> "has been delivered.";
      case "CANCELLED" -> "has been cancelled.";
      case "RETURNED" -> "has been returned.";
      default -> "has a new status: " + status + ".";
    };
    send(customerId, "CUSTOMER_ORDER_STATUS:" + key, "ORDER_STATUS",
        "DISPATCHED".equals(status) ? "Out for delivery" : "Order update",
        "Your order " + number + " " + message, orderId);
    notifyAdmins("ADMIN_ORDER_STATUS:" + key, "ORDER_STATUS", "Order status updated",
        "Order " + number + " " + message, orderId);

    if ("DISPATCHED".equals(status) || "CANCELLED".equals(status)) {
      List<UUID> riders = jdbc.query("""
          SELECT a.rider_id
          FROM public.delivery_assignments a
          JOIN public.users u ON u.id = a.rider_id
          WHERE a.order_id = ? AND u.enabled = TRUE AND u.role = 'RIDER'
          """, (rs, row) -> rs.getObject("rider_id", UUID.class), orderId);
      for (UUID riderId : riders) {
        send(riderId, "RIDER_ORDER_STATUS:" + key, "DELIVERY_UPDATE",
            "DISPATCHED".equals(status) ? "Delivery ready" : "Delivery cancelled",
            "Order " + number + " " + message
                + ("DISPATCHED".equals(status)
                    ? " Check your deliveries for the customer details."
                    : " Do not deliver this order."),
            orderId);
      }
    }
  }

  @Transactional(readOnly = true)
  public NotificationPage list(UUID userId, int page, int size) {
    requireUser(userId);
    if (page < 0 || size < 1 || size > 50) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination.");
    }
    var counts = jdbc.queryForMap("""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE read_at IS NULL) AS unread
        FROM public.notifications WHERE user_id = ?
        """, userId);
    long total = ((Number) counts.get("total")).longValue();
    long unread = ((Number) counts.get("unread")).longValue();
    List<NotificationResponse> items = jdbc.query("""
        SELECT id, type, title, message, order_id, created_at, read_at
        FROM public.notifications WHERE user_id = ?
        ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
        """, (rs, row) -> {
      var readAt = rs.getTimestamp("read_at");
      return new NotificationResponse(rs.getObject("id", UUID.class),
          rs.getString("type"), rs.getString("title"), rs.getString("message"),
          rs.getObject("order_id", UUID.class), rs.getTimestamp("created_at").toInstant(),
          readAt == null ? null : readAt.toInstant());
    }, userId, size, (long) page * size);
    return new NotificationPage(items, page, size, total,
        (int) ((total + size - 1) / size), unread);
  }

  @Transactional
  public void markRead(UUID userId, UUID id) {
    requireUser(userId);
    int updated = jdbc.update("""
        UPDATE public.notifications
        SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE id = ? AND user_id = ?
        """, id, userId);
    if (updated == 0)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found.");
  }

  @Transactional
  public void markAllRead(UUID userId) {
    requireUser(userId);
    jdbc.update("""
        UPDATE public.notifications SET read_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND read_at IS NULL
        """, userId);
  }

  private void send(UUID userId, String eventKey, String type, String title, String message, UUID orderId) {
    jdbc.update("""
        INSERT INTO public.notifications (user_id, event_key, type, title, message, order_id)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, event_key) DO NOTHING
        """, userId, eventKey, type, title, message, orderId);
  }

  private void notifyAdmins(String eventKey, String type, String title, String message, UUID orderId) {
    jdbc.update("""
        INSERT INTO public.notifications (user_id, event_key, type, title, message, order_id)
        SELECT id, ?, ?, ?, ?, ? FROM public.users
        WHERE role = 'ADMIN' AND enabled = TRUE
        ON CONFLICT (user_id, event_key) DO NOTHING
        """, eventKey, type, title, message, orderId);
  }

  private void requireUser(UUID userId) {
    Boolean enabled = jdbc.queryForObject("""
        SELECT EXISTS (SELECT 1 FROM public.users WHERE id = ? AND enabled = TRUE)
        """, Boolean.class, userId);
    if (!Boolean.TRUE.equals(enabled)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }
  }

  public record NotificationResponse(UUID id, String type, String title, String message,
      UUID orderId, Instant createdAt, Instant readAt) {
  }

  public record NotificationPage(List<NotificationResponse> items, int page, int size,
      long totalItems, int totalPages, long unreadCount) {
  }
}
