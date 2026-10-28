package com.shopmart.api.returns;

import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping({"/api/admin/returns", "/api/mobile/admin/returns"})
public class AdminSafepayRefundController {

  private final AdminSafepayRefundService refunds;

  public AdminSafepayRefundController(AdminSafepayRefundService refunds) {
    this.refunds = refunds;
  }

  @PostMapping("/{id}/safepay-refund")
  public ResponseEntity<AdminSafepayRefundService.Result> record(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    UUID adminId;

    try {
      adminId = UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    var result = refunds.refund(adminId, id);

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(result);
  }
}