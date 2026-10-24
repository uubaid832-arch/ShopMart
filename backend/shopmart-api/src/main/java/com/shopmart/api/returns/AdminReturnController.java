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
@RequestMapping("/api/admin/returns")
public class AdminReturnController {

  private final AdminReturnService returns;

  public AdminReturnController(AdminReturnService returns) {
    this.returns = returns;
  }

  @GetMapping
  public ResponseEntity<ReturnService.Page<AdminReturnService.ReturnSummary>> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(returns.list(userId(jwt), page, size));
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<Void> updateStatus(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AdminReturnService.StatusRequest request) {
    returns.updateStatus(userId(jwt), id, request);

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