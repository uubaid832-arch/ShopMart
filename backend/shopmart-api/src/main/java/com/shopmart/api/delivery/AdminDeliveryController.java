package com.shopmart.api.delivery;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/deliveries")
public class AdminDeliveryController {

  private final DeliveryService deliveries;
  private final JdbcTemplate jdbc;

  public AdminDeliveryController(DeliveryService deliveries, JdbcTemplate jdbc) {
    this.deliveries = deliveries;
    this.jdbc = jdbc;
  }

  @GetMapping
  public ResponseEntity<DeliveryService.DeliveryPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(deliveries.list(userId(jwt), page, size));
  }

  @GetMapping("/riders")
  public ResponseEntity<List<DeliveryService.RiderResponse>> riders(
      @AuthenticationPrincipal Jwt jwt) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(deliveries.riders(userId(jwt)));
  }

  @GetMapping("/{orderId}/assignment")
  public ResponseEntity<AssignmentState> assignment(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID orderId) {

    // This service checks the caller's enabled ADMIN role in the database.
    List<DeliveryService.RiderResponse> riders = deliveries.riders(userId(jwt));

    List<AssignmentDetails> matches = jdbc.query("""
        SELECT o.id, o.order_number, o.recipient_name,
               o.address_line, o.city, a.rider_id,
               r.name AS rider_name,
               (r.enabled = TRUE AND r.role = 'RIDER') AS rider_enabled
        FROM public.orders o
        LEFT JOIN public.delivery_assignments a ON a.order_id = o.id
        LEFT JOIN public.users r ON r.id = a.rider_id
        WHERE o.id = ?
        """,
        (rs, row) -> new AssignmentDetails(
            rs.getObject("id", UUID.class),
            rs.getString("order_number"),
            rs.getString("recipient_name"),
            rs.getString("address_line") + ", " + rs.getString("city"),
            rs.getObject("rider_id", UUID.class),
            rs.getString("rider_name"),
            rs.getBoolean("rider_enabled")),
        orderId);

    if (matches.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found.");
    }

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(new AssignmentState(matches.get(0), riders));
  }

  @PutMapping("/{orderId}/assignment")
  public ResponseEntity<Void> assign(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID orderId,
      @Valid @RequestBody DeliveryService.AssignmentRequest request) {
    deliveries.assign(userId(jwt), orderId, request.riderId());
    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @PatchMapping("/{orderId}/details")
  public ResponseEntity<Void> updateDetails(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID orderId,
      @Valid @RequestBody DeliveryService.DeliveryDetailsRequest request) {
    deliveries.updateDetails(userId(jwt), orderId, request);
    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  private static UUID userId(Jwt jwt) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    try {
      return UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
  }

  public record AssignmentDetails(
      UUID orderId,
      String orderNumber,
      String customerName,
      String address,
      UUID riderId,
      String riderName,
      boolean riderEnabled) {
  }

  public record AssignmentState(
      AssignmentDetails delivery,
      List<DeliveryService.RiderResponse> riders) {
  }
}
