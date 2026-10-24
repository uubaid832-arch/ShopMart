package com.shopmart.api.orders;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderTrackingService {

  private final JdbcTemplate jdbc;
  private final OrderService orders;

  public OrderTrackingService(JdbcTemplate jdbc, OrderService orders) {
    this.jdbc = jdbc;
    this.orders = orders;
  }

  @Transactional(readOnly = true)
  public TrackingResponse get(UUID userId, UUID orderId) {
    // Existing ownership check prevents access to another customer's order.
    var order = orders.getOrder(userId, orderId);

    List<TrackingEvent> events = jdbc.query("""
        SELECT id, status, created_at
        FROM public.order_status_history
        WHERE order_id = ?
        ORDER BY created_at, id
        """,
        (rs, row) -> new TrackingEvent(
            rs.getObject("id", UUID.class),
            rs.getString("status"),
            message(rs.getString("status")),
            rs.getTimestamp("created_at").toInstant()),
        orderId);

    return new TrackingResponse(
        order.id(),
        order.orderNumber(),
        order.status(),
        events);
  }

  private static String message(String status) {
    return switch (status) {
      case "PENDING" -> "Your order has been placed.";
      case "CONFIRMED" -> "Your order has been confirmed.";
      case "DISPATCHED" -> "Your order has been dispatched.";
      case "DELIVERED" -> "Your order has been delivered.";
      case "CANCELLED" -> "Your order has been cancelled.";
      case "RETURNED" -> "Your order has been returned.";
      default -> "Order status: " + status;
    };
  }

  public record TrackingResponse(
      UUID id,
      String orderNumber,
      String status,
      List<TrackingEvent> events) {
  }

  public record TrackingEvent(
      UUID id,
      String status,
      String message,
      Instant createdAt) {
  }
}