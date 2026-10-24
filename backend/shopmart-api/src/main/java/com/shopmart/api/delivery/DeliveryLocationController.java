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
public class DeliveryLocationController {

  private final DeliveryLocationService locations;

  public DeliveryLocationController(DeliveryLocationService locations) {
    this.locations = locations;
  }

  @PutMapping("/api/rider/deliveries/{id}/location")
  public ResponseEntity<Void> update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody DeliveryLocationService.LocationRequest request) {

    locations.update(userId(jwt), id, request);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @DeleteMapping("/api/rider/deliveries/{id}/location")
  public ResponseEntity<Void> stop(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {

    locations.stop(userId(jwt), id);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @GetMapping("/api/orders/{id}/location")
  public ResponseEntity<DeliveryLocationService.LocationResponse> get(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(locations.get(userId(jwt), id));
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