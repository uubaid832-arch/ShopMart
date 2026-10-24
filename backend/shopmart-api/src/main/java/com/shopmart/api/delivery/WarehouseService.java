package com.shopmart.api.delivery;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.shopmart.api.notifications.NotificationService;
import com.shopmart.api.orders.OrderPaymentRules;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;

@Service
@Validated
public class WarehouseService {

  private final JdbcTemplate jdbc;
  private final NotificationService notifications;

  public WarehouseService(
      JdbcTemplate jdbc,
      NotificationService notifications) {
    this.jdbc = jdbc;
    this.notifications = notifications;
  }

  @Transactional(readOnly = true)
  public WarehouseState get(UUID userId, UUID orderId) {
    String userRole = role(userId);

    if ("RIDER".equals(userRole)) {
      requireAssignment(userId, orderId);
    } else if (!"ADMIN".equals(userRole)) {
      throw failure(HttpStatus.FORBIDDEN, "Access denied.");
    }

    Boolean exists = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.orders WHERE id = ?
        )
        """, Boolean.class, orderId);

    if (!Boolean.TRUE.equals(exists)) {
      throw failure(HttpStatus.NOT_FOUND, "Order not found.");
    }

    List<WarehouseState> states = jdbc.query("""
        SELECT id, reason, note, created_at,
               warehouse_reported_at, warehouse_received_at,
               resolution, resolved_at
        FROM public.delivery_attempts
        WHERE order_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        """,
        (rs, row) -> new WarehouseState(
            rs.getObject("id", UUID.class),
            rs.getString("reason"),
            rs.getString("note"),
            rs.getTimestamp("created_at").toInstant(),
            instant(rs.getTimestamp("warehouse_reported_at")),
            instant(rs.getTimestamp("warehouse_received_at")),
            rs.getString("resolution"),
            instant(rs.getTimestamp("resolved_at"))),
        orderId);

    return states.isEmpty()
        ? new WarehouseState(null, null, null, null, null, null, null, null)
        : states.get(0);
  }

  @Transactional
  public void reportReturn(
      UUID riderId,
      UUID orderId,
      @Valid AttemptRequest request) {
    requireRole(riderId, "RIDER");

    var order = lockOrder(orderId);
    requireAssignment(riderId, orderId);

    var attempt = latestAttempt(orderId, request.attemptId());

    if (!Objects.equals(attempt.get("rider_id"), riderId)) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Only the rider who reported this attempt can return it.");
    }

    if (attempt.get("warehouse_reported_at") != null) {
      return;
    }

    requireDispatchedDelivery(order);

    if (attempt.get("resolved_at") != null) {
      throw failure(
          HttpStatus.CONFLICT,
          "This attempt is already resolved.");
    }

    jdbc.update("""
        UPDATE public.delivery_attempts
        SET warehouse_reported_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, request.attemptId());

    notifyParticipants(
        orderId,
        "WAREHOUSE_REPORTED:" + request.attemptId(),
        "Parcel returned to warehouse",
        "The rider reported that order "
            + order.get("order_number")
            + " was returned to the warehouse."
            + " Administrator receipt confirmation is pending.");
  }

  @Transactional
  public void confirmReceipt(
      UUID adminId,
      UUID orderId,
      @Valid AttemptRequest request) {
    requireRole(adminId, "ADMIN");

    var order = lockOrder(orderId);
    var attempt = latestAttempt(orderId, request.attemptId());

    if (attempt.get("warehouse_received_at") != null) {
      return;
    }

    requireDispatchedDelivery(order);

    if (attempt.get("warehouse_reported_at") == null
        || attempt.get("resolved_at") != null) {
      throw failure(
          HttpStatus.CONFLICT,
          "The rider must report the parcel returned first.");
    }

    jdbc.update("""
        UPDATE public.delivery_attempts
        SET warehouse_received_at = CURRENT_TIMESTAMP,
            warehouse_received_by = ?
        WHERE id = ?
        """, adminId, request.attemptId());

    notifyParticipants(
        orderId,
        "WAREHOUSE_RECEIVED:" + request.attemptId(),
        "Warehouse receipt confirmed",
        "The warehouse has received order "
            + order.get("order_number")
            + ". The administrator will arrange another delivery or cancel it.");
  }

  @Transactional
  public void resolve(
      UUID adminId,
      UUID orderId,
      @Valid ResolutionRequest request) {
    requireRole(adminId, "ADMIN");

    var order = lockOrder(orderId);

    var matches = jdbc.queryForList("""
        SELECT *
        FROM public.delivery_attempts
        WHERE id = ? AND order_id = ?
        FOR UPDATE
        """, request.attemptId(), orderId);

    if (matches.isEmpty()) {
      throw failure(
          HttpStatus.NOT_FOUND,
          "Delivery attempt not found.");
    }

    var attempt = matches.get(0);
    boolean retry = "RETRY".equals(request.action());

    // Repeating the same resolution must not restore stock twice.
    if (attempt.get("resolved_at") != null) {
      boolean same = request.action().equals(attempt.get("resolution"))
          && (!retry || Objects.equals(
              request.riderId(), attempt.get("resolution_rider_id")));

      if (same) {
        return;
      }

      throw failure(
          HttpStatus.CONFLICT,
          "This delivery attempt already has a different resolution.");
    }

    latestAttempt(orderId, request.attemptId());
    requireDispatchedDelivery(order);

    if (attempt.get("warehouse_received_at") == null) {
      throw failure(
          HttpStatus.CONFLICT,
          "Confirm physical warehouse receipt before retrying or cancelling.");
    }

    UUID previousRider = jdbc.queryForObject("""
        SELECT rider_id
        FROM public.delivery_assignments
        WHERE order_id = ?
        """, UUID.class, orderId);

    if (retry) {
      if (request.riderId() == null) {
        throw failure(HttpStatus.BAD_REQUEST, "Select a rider.");
      }

      var riders = jdbc.queryForList("""
          SELECT id
          FROM public.users
          WHERE id = ? AND role = 'RIDER' AND enabled = TRUE
          FOR SHARE
          """, request.riderId());

      if (riders.isEmpty()) {
        throw failure(
            HttpStatus.BAD_REQUEST,
            "Select an enabled rider.");
      }

      jdbc.update("""
          INSERT INTO public.delivery_assignments (
              order_id, rider_id, assigned_by
          )
          VALUES (?, ?, ?)
          ON CONFLICT (order_id)
          DO UPDATE SET
              rider_id = EXCLUDED.rider_id,
              assigned_by = EXCLUDED.assigned_by,
              assigned_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          """, orderId, request.riderId(), adminId);
    } else {
      var items = jdbc.queryForList("""
          SELECT product_id, quantity
          FROM public.order_items
          WHERE order_id = ?
          ORDER BY product_id
          """, orderId);

      for (var item : items) {
        int changed = jdbc.update("""
            UPDATE public.products
            SET stock = stock + ?,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, item.get("quantity"), item.get("product_id"));

        if (changed != 1) {
          throw failure(
              HttpStatus.CONFLICT,
              "Could not restore product stock.");
        }
      }
    }

    String next = retry ? "CONFIRMED" : "CANCELLED";

    // Retrying preserves DEMO_PAID.
    // Cancelling voids a demo payment without recording a real refund.
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

    // Close the failed attempts belonging to this delivery cycle.
    jdbc.update("""
        UPDATE public.delivery_attempts
        SET resolved_at = CURRENT_TIMESTAMP,
            resolution = ?,
            resolution_rider_id = ?
        WHERE order_id = ? AND resolved_at IS NULL
        """,
        request.action(),
        retry ? request.riderId() : null,
        orderId);

    if (retry) {
      notifications.deliveryAssigned(
          orderId, request.riderId(), previousRider);

      notifyParticipants(
          orderId,
          "DELIVERY_RETRY:" + request.attemptId(),
          "Another delivery arranged",
          "Another delivery has been arranged for order "
              + order.get("order_number")
              + ". The order is awaiting dispatch.");
    } else {
      notifications.orderStatusChanged(orderId, "CANCELLED");
    }
  }

  private Map<String, Object> lockOrder(UUID orderId) {
    var rows = jdbc.queryForList("""
        SELECT id, order_number, status,
               payment_method, payment_status
        FROM public.orders
        WHERE id = ?
        FOR UPDATE
        """, orderId);

    if (rows.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Order not found.");
    }

    return rows.get(0);
  }

  private Map<String, Object> latestAttempt(
      UUID orderId, UUID attemptId) {
    var rows = jdbc.queryForList("""
        SELECT *
        FROM public.delivery_attempts
        WHERE order_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
        """, orderId);

    if (rows.isEmpty()
        || !attemptId.equals(rows.get(0).get("id"))) {
      throw failure(
          HttpStatus.CONFLICT,
          "The delivery attempt has changed. Refresh before continuing.");
    }

    return rows.get(0);
  }

  private void requireDispatchedDelivery(Map<String, Object> order) {
    if (!"DISPATCHED".equals(order.get("status"))
        || !OrderPaymentRules.supportsDelivery(order)) {
      throw failure(
          HttpStatus.CONFLICT,
          "Only dispatched COD or successful demo-payment orders support this action.");
    }
  }

  private void requireAssignment(UUID riderId, UUID orderId) {
    Boolean assigned = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1
            FROM public.delivery_assignments
            WHERE order_id = ? AND rider_id = ?
        )
        """, Boolean.class, orderId, riderId);

    if (!Boolean.TRUE.equals(assigned)) {
      throw failure(HttpStatus.NOT_FOUND, "Delivery not found.");
    }
  }

  private String role(UUID userId) {
    List<String> roles = jdbc.query("""
        SELECT role
        FROM public.users
        WHERE id = ? AND enabled = TRUE
        """, (rs, row) -> rs.getString("role"), userId);

    if (roles.isEmpty()) {
      throw failure(HttpStatus.FORBIDDEN, "Access denied.");
    }

    return roles.get(0);
  }

  private void requireRole(UUID userId, String expected) {
    if (!expected.equals(role(userId))) {
      throw failure(HttpStatus.FORBIDDEN, "Access denied.");
    }
  }

  private void notifyParticipants(
      UUID orderId,
      String event,
      String title,
      String message) {
    jdbc.update("""
        INSERT INTO public.notifications (
            user_id, event_key, type, title, message, order_id
        )
        SELECT u.id, ?, 'DELIVERY_UPDATE', ?, ?, o.id
        FROM public.orders o
        JOIN public.users u ON u.enabled = TRUE
        WHERE o.id = ?
          AND (
              u.role = 'ADMIN'
              OR u.id = o.user_id
              OR (
                  u.role = 'RIDER'
                  AND EXISTS (
                      SELECT 1
                      FROM public.delivery_assignments a
                      WHERE a.order_id = o.id AND a.rider_id = u.id
                  )
              )
          )
        ON CONFLICT (user_id, event_key) DO NOTHING
        """, event, title, message, orderId);
  }

  private static Instant instant(java.sql.Timestamp value) {
    return value == null ? null : value.toInstant();
  }

  private static ResponseStatusException failure(
      HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }

  public record AttemptRequest(@NotNull UUID attemptId) {
  }

  public record ResolutionRequest(
      @NotNull UUID attemptId,
      @NotBlank @Pattern(regexp = "RETRY|CANCEL") String action,
      UUID riderId) {
  }

  public record WarehouseState(
      UUID attemptId,
      String reason,
      String note,
      Instant createdAt,
      Instant reportedAt,
      Instant receivedAt,
      String resolution,
      Instant resolvedAt) {
  }
}