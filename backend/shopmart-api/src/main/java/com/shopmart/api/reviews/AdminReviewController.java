package com.shopmart.api.reviews;

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
@RequestMapping({"/api/admin/reviews", "/api/mobile/admin/reviews"})
public class AdminReviewController {

  private final AdminReviewService reviews;

  public AdminReviewController(AdminReviewService reviews) {
    this.reviews = reviews;
  }

  @GetMapping
  public ResponseEntity<AdminReviewService.ReviewPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(reviews.list(userId(jwt), page, size));
  }

  @PatchMapping("/{id}/visibility")
  public ResponseEntity<Void> updateVisibility(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AdminReviewService.VisibilityRequest request) {
    reviews.updateVisibility(userId(jwt), id, request);

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