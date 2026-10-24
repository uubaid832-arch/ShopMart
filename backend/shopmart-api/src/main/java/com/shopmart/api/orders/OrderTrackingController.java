package com.shopmart.api.orders;

import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/orders")
public class OrderTrackingController {

  private final OrderTrackingService tracking;

  public OrderTrackingController(OrderTrackingService tracking) {
    this.tracking = tracking;
  }

  @GetMapping("/{id}/tracking")
  public ResponseEntity<OrderTrackingService.TrackingResponse> get(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    UUID userId;

    try {
      userId = UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(tracking.get(userId, id));
  }
}