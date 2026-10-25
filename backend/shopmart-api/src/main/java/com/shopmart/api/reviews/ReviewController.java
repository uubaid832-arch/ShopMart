package com.shopmart.api.reviews;

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
@RequestMapping({
    "/api/products/{productId}/reviews",
    "/api/mobile/products/{productId}/reviews"
})
public class ReviewController {

  private final ReviewService reviews;

  public ReviewController(ReviewService reviews) {
    this.reviews = reviews;
  }

  @GetMapping
  public ResponseEntity<ReviewService.ReviewPage> list(
      @PathVariable UUID productId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(reviews.list(productId, page, size));
  }

  @GetMapping("/eligibility")
  public ResponseEntity<ReviewService.Eligibility> eligibility(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID productId) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(reviews.eligibility(userId(jwt), productId));
  }

  @PostMapping
  public ResponseEntity<Map<String, UUID>> create(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID productId,
      @Valid @RequestBody ReviewService.ReviewRequest request) {
    UUID id = reviews.create(userId(jwt), productId, request);

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