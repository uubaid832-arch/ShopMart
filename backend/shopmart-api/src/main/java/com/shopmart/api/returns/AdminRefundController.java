package com.shopmart.api.returns;

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
@RequestMapping({"/api/admin/returns", "/api/mobile/admin/returns"})
public class AdminRefundController {

  private final AdminRefundService refunds;

  public AdminRefundController(AdminRefundService refunds) {
    this.refunds = refunds;
  }

  @PostMapping("/{id}/refund")
  public ResponseEntity<Void> record(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AdminRefundService.RefundRequest request) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    UUID adminId;

    try {
      adminId = UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    refunds.record(adminId, id, request);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }
}