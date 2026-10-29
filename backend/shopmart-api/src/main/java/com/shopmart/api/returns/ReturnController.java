package com.shopmart.api.returns;

import java.util.Map;
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
@RequestMapping({ "/api/returns", "/api/mobile/returns" })
public class ReturnController {

  private final ReturnService returns;

  public ReturnController(ReturnService returns) {
    this.returns = returns;
  }

  @GetMapping("/eligible")
  public ResponseEntity<ReturnService.Page<ReturnService.EligibleItem>> eligible(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) UUID orderId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(returns.eligible(userId(jwt), page, size, orderId));
  }

  @GetMapping
  public ResponseEntity<ReturnService.Page<ReturnService.ReturnResponse>> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) UUID orderId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(returns.list(userId(jwt), page, size, orderId));
  }

  @PostMapping
  public ResponseEntity<Map<String, UUID>> create(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody ReturnService.CreateReturnRequest request) {
    UUID id = returns.create(userId(jwt), request);

    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(Map.of("id", id));
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
