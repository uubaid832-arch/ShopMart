package com.shopmart.api.admin;

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
@RequestMapping("/api/admin/products")
public class AdminProductController {

  private final AdminProductService products;

  public AdminProductController(AdminProductService products) {
    this.products = products;
  }

  @GetMapping
  public ResponseEntity<AdminProductService.ProductPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(products.list(userId(jwt), page, size));
  }

  @PostMapping
  public ResponseEntity<AdminProductService.ProductResponse> create(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody AdminProductService.ProductRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(products.create(userId(jwt), request));
  }

  @PutMapping("/{id}")
  public ResponseEntity<AdminProductService.ProductResponse> update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AdminProductService.ProductRequest request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(products.update(userId(jwt), id, request));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestParam long version) {

    products.delete(userId(jwt), id, version);

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