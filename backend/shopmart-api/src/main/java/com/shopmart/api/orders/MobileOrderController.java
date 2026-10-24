package com.shopmart.api.orders;

import java.util.UUID;
import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static com.shopmart.api.orders.OrderModels.*;

@RestController
@RequestMapping("/api/mobile/orders")
public class MobileOrderController {

  private final OrderService orders;
  private final OrderTrackingService tracking;

  public MobileOrderController(
      OrderService orders,
      OrderTrackingService tracking) {
    this.orders = orders;
    this.tracking = tracking;
  }

  @PostMapping
  public ResponseEntity<OrderReceipt> create(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody CreateOrderRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(orders.create(userId(jwt), request));
  }

  @GetMapping
  public ResponseEntity<OrderPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(orders.getOrders(userId(jwt), page, size));
  }

  @GetMapping("/{id}")
  public ResponseEntity<OrderReceipt> get(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(orders.getOrder(userId(jwt), id));
  }

  @GetMapping("/{id}/tracking")
  public ResponseEntity<OrderTrackingService.TrackingResponse> tracking(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(tracking.get(userId(jwt), id));
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
}