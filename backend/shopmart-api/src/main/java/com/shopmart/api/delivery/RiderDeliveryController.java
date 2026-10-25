package com.shopmart.api.delivery;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping({
    "/api/rider/deliveries",
    "/api/mobile/rider/deliveries"
})
public class RiderDeliveryController {

  private final RiderDeliveryService deliveries;

  public RiderDeliveryController(RiderDeliveryService deliveries) {
    this.deliveries = deliveries;
  }

  @GetMapping
  public ResponseEntity<RiderDeliveryService.DeliveryPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(defaultValue = "ALL") String section) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(deliveries.list(userId(jwt), page, size, section));
  }

  @PatchMapping("/{id}/complete")
  public ResponseEntity<Void> complete(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {

    deliveries.complete(userId(jwt), id);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @PatchMapping("/{id}/failed")
  public ResponseEntity<Void> reportFailure(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody RiderDeliveryService.FailureRequest request) {

    deliveries.reportFailure(userId(jwt), id, request);

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
}