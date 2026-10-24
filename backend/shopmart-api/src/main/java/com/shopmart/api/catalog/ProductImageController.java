package com.shopmart.api.catalog;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ProductImageController {

  private final ProductImageService images;

  public ProductImageController(ProductImageService images) {
    this.images = images;
  }

  @GetMapping("/product-images")
  public ResponseEntity<List<ProductImageService.ProductImage>> catalog(
      @RequestParam List<UUID> productIds) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(images.catalog(productIds));
  }

  @GetMapping("/product-images/files/{imageId}")
  public ResponseEntity<?> file(
      @PathVariable UUID imageId) {

    String cloudUrl = images.cloudUrl(imageId);
    if (cloudUrl != null) {
      return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(cloudUrl))
          .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic()).build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.IMAGE_JPEG)
        .header("X-Content-Type-Options", "nosniff")
        .cacheControl(
            CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
        .body(images.file(imageId));
  }

  @GetMapping("/admin/products/{productId}/images")
  public ResponseEntity<List<ProductImageService.ProductImage>> list(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID productId) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(images.list(userId(jwt), productId));
  }

  @PostMapping(value = "/admin/products/{productId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<List<ProductImageService.ProductImage>> upload(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID productId,
      @RequestPart("files") List<MultipartFile> files) {

    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(images.upload(userId(jwt), productId, files));
  }

  @PatchMapping("/admin/products/{productId}/images/{imageId}/primary")
  public ResponseEntity<List<ProductImageService.ProductImage>> primary(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID productId,
      @PathVariable UUID imageId) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(images.makePrimary(userId(jwt), productId, imageId));
  }

  @DeleteMapping("/admin/products/{productId}/images/{imageId}")
  public ResponseEntity<List<ProductImageService.ProductImage>> delete(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID productId,
      @PathVariable UUID imageId) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(images.delete(userId(jwt), productId, imageId));
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