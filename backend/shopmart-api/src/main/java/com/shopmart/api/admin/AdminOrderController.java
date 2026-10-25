package com.shopmart.api.admin;

import java.util.UUID;
import jakarta.validation.Valid;

import com.shopmart.api.orders.OrderModels.OrderReceipt;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping({"/api/admin/orders", "/api/mobile/admin/orders"})
public class AdminOrderController {

  private final AdminOrderService orders;

  public AdminOrderController(AdminOrderService orders) {
    this.orders = orders;
  }

  @GetMapping
  public ResponseEntity<AdminOrderService.OrderPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(orders.list(userId(jwt), page, size));
  }

  @GetMapping("/{id}")
  public ResponseEntity<OrderReceipt> get(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(orders.get(userId(jwt), id));
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<OrderReceipt> updateStatus(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AdminOrderService.StatusRequest request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(orders.updateStatus(userId(jwt), id, request));
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