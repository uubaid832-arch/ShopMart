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
@RequestMapping("/api")
public class WarehouseController {

  private final WarehouseService warehouse;

  public WarehouseController(WarehouseService warehouse) {
    this.warehouse = warehouse;
  }

  @GetMapping({
      "/admin/deliveries/{orderId}/warehouse",
      "/rider/deliveries/{orderId}/warehouse",
      "/mobile/rider/deliveries/{orderId}/warehouse"
  })
  public ResponseEntity<WarehouseService.WarehouseState> get(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID orderId) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(warehouse.get(userId(jwt), orderId));
  }

  @PatchMapping({"/rider/deliveries/{orderId}/warehouse-return",
      "/mobile/rider/deliveries/{orderId}/warehouse-return"})
  public ResponseEntity<Void> reportReturn(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID orderId,
      @Valid @RequestBody WarehouseService.AttemptRequest request) {

    warehouse.reportReturn(userId(jwt), orderId, request);
    return noContent();
  }

  @PatchMapping("/admin/deliveries/{orderId}/warehouse-receipt")
  public ResponseEntity<Void> confirmReceipt(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID orderId,
      @Valid @RequestBody WarehouseService.AttemptRequest request) {

    warehouse.confirmReceipt(userId(jwt), orderId, request);
    return noContent();
  }

  @PostMapping("/admin/deliveries/{orderId}/resolution")
  public ResponseEntity<Void> resolve(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID orderId,
      @Valid @RequestBody WarehouseService.ResolutionRequest request) {

    warehouse.resolve(userId(jwt), orderId, request);
    return noContent();
  }

  private static ResponseEntity<Void> noContent() {
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