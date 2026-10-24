package com.shopmart.api.delivery;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DeliveryLocationService {

  private static final Duration LOCATION_LIFETIME = Duration.ofMinutes(2);

  private final JdbcTemplate jdbc;

  public DeliveryLocationService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional
  public void update(
      UUID riderId,
      UUID orderId,
      LocationRequest request) {

    requireRider(riderId);

    var order = lockAssignedOrder(riderId, orderId);

    if (!"DISPATCHED".equals(order.get("status"))) {
      throw failure(
          HttpStatus.CONFLICT,
          "Location sharing is available only for dispatched orders.");
    }

    if (warehouseReturnPending(orderId)) {
      throw failure(
          HttpStatus.CONFLICT,
          "Location sharing is paused while the parcel is returning to the warehouse.");
    }

    jdbc.update("""
        INSERT INTO public.delivery_locations (
            order_id, rider_id, assignment_time,
            latitude, longitude, accuracy, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, clock_timestamp())
        ON CONFLICT (order_id)
        DO UPDATE SET
            rider_id = EXCLUDED.rider_id,
            assignment_time = EXCLUDED.assignment_time,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            accuracy = EXCLUDED.accuracy,
            updated_at = clock_timestamp()
        """,
        orderId,
        riderId,
        order.get("assigned_at"),
        request.latitude(),
        request.longitude(),
        request.accuracy());
  }

  @Transactional
  public void stop(UUID riderId, UUID orderId) {
    requireRider(riderId);
    lockAssignedOrder(riderId, orderId);

    jdbc.update("""
        DELETE FROM public.delivery_locations
        WHERE order_id = ? AND rider_id = ?
        """, orderId, riderId);
  }

  @Transactional(readOnly = true)
  public LocationResponse get(UUID viewerId, UUID orderId) {
    var matches = jdbc.queryForList("""
        SELECT o.status,
               a.rider_id,
               r.enabled AS rider_enabled,
               r.role AS rider_role,
               l.latitude,
               l.longitude,
               l.accuracy,
               l.updated_at,
               EXISTS (
                   SELECT 1
                   FROM public.delivery_attempts d
                   WHERE d.order_id = o.id
                     AND d.warehouse_reported_at IS NOT NULL
                     AND d.resolved_at IS NULL
               ) AS warehouse_pending
        FROM public.orders o
        JOIN public.users viewer
          ON viewer.id = ? AND viewer.enabled = TRUE
        LEFT JOIN public.delivery_assignments a
          ON a.order_id = o.id
        LEFT JOIN public.users r
          ON r.id = a.rider_id
        LEFT JOIN public.delivery_locations l
          ON l.order_id = o.id
         AND l.rider_id = a.rider_id
         AND l.assignment_time = a.assigned_at
        WHERE o.id = ?
          AND (
              viewer.role = 'ADMIN'
              OR (
                  viewer.role = 'CUSTOMER'
                  AND o.user_id = viewer.id
              )
              OR (
                  viewer.role = 'RIDER'
                  AND a.rider_id = viewer.id
              )
          )
        """, viewerId, orderId);

    if (matches.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Order not found.");
    }

    var row = matches.get(0);

    boolean canShow = "DISPATCHED".equals(row.get("status"))
        && Boolean.TRUE.equals(row.get("rider_enabled"))
        && "RIDER".equals(row.get("rider_role"))
        && !Boolean.TRUE.equals(row.get("warehouse_pending"));

    if (!canShow || row.get("updated_at") == null) {
      return unavailable("UNAVAILABLE", null);
    }

    Instant updatedAt = ((java.sql.Timestamp) row.get("updated_at")).toInstant();

    if (updatedAt.isBefore(Instant.now().minus(LOCATION_LIFETIME))) {
      return unavailable("STALE", updatedAt);
    }

    return new LocationResponse(
        true,
        "RECENT",
        ((Number) row.get("latitude")).doubleValue(),
        ((Number) row.get("longitude")).doubleValue(),
        ((Number) row.get("accuracy")).doubleValue(),
        updatedAt);
  }

  private java.util.Map<String, Object> lockAssignedOrder(
      UUID riderId,
      UUID orderId) {

    var matches = jdbc.queryForList("""
        SELECT o.status, a.assigned_at
        FROM public.orders o
        JOIN public.delivery_assignments a ON a.order_id = o.id
        WHERE o.id = ? AND a.rider_id = ?
        FOR UPDATE OF o
        """, orderId, riderId);

    if (matches.isEmpty()) {
      throw failure(
          HttpStatus.NOT_FOUND,
          "This delivery is not assigned to you.");
    }

    return matches.get(0);
  }

  private boolean warehouseReturnPending(UUID orderId) {
    Boolean pending = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1
            FROM public.delivery_attempts
            WHERE order_id = ?
              AND warehouse_reported_at IS NOT NULL
              AND resolved_at IS NULL
        )
        """, Boolean.class, orderId);

    return Boolean.TRUE.equals(pending);
  }

  private void requireRider(UUID riderId) {
    Boolean allowed = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = ?
              AND enabled = TRUE
              AND role = 'RIDER'
        )
        """, Boolean.class, riderId);

    if (!Boolean.TRUE.equals(allowed)) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Delivery rider access is required.");
    }
  }

  private static LocationResponse unavailable(
      String state,
      Instant updatedAt) {

    return new LocationResponse(
        false, state, null, null, null, updatedAt);
  }

  private static ResponseStatusException failure(
      HttpStatus status,
      String message) {

    return new ResponseStatusException(status, message);
  }

  public record LocationRequest(
      @NotNull @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,

      @NotNull @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,

      @NotNull @DecimalMin("0") @DecimalMax("1000000") BigDecimal accuracy) {
  }

  public record LocationResponse(
      boolean available,
      String state,
      Double latitude,
      Double longitude,
      Double accuracy,
      Instant updatedAt) {
  }
}