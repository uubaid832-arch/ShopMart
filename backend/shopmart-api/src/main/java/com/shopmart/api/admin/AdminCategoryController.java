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
@RequestMapping({"/api/admin/categories", "/api/mobile/admin/categories"})
public class AdminCategoryController {

  private final AdminCategoryService categories;

  public AdminCategoryController(AdminCategoryService categories) {
    this.categories = categories;
  }

  @PostMapping
  public ResponseEntity<AdminCategoryService.CategoryResponse> create(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody AdminCategoryService.CategoryRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(categories.create(userId(jwt), request));
  }

  @PutMapping("/{id}")
  public ResponseEntity<AdminCategoryService.CategoryResponse> update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AdminCategoryService.CategoryRequest request) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(categories.update(userId(jwt), id, request));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {

    categories.delete(userId(jwt), id);

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