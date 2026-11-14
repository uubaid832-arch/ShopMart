package com.shopmart.api.admin;

import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping({"/api/admin/settings", "/api/mobile/admin/settings"})
public class AdminStoreSettingsController {

  private final AdminStoreSettingsService settings;

  public AdminStoreSettingsController(AdminStoreSettingsService settings) {
    this.settings = settings;
  }

  @GetMapping("/warehouse-address")
  public ResponseEntity<AdminStoreSettingsService.WarehouseAddress> get(
      @AuthenticationPrincipal Jwt jwt) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(settings.get(userId(jwt)));
  }

  @PutMapping("/warehouse-address")
  public ResponseEntity<AdminStoreSettingsService.WarehouseAddress> update(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody AdminStoreSettingsService.WarehouseAddressRequest request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(settings.update(userId(jwt), request));
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
