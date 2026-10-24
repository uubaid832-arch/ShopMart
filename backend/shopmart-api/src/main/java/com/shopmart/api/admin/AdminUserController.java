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
@RequestMapping("/api/admin/users")
public class AdminUserController {

  private final AdminUserService users;

  public AdminUserController(AdminUserService users) {
    this.users = users;
  }

  @GetMapping
  public ResponseEntity<AdminUserService.UserPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "") String search,
      @RequestParam(defaultValue = "ALL") String role) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(users.list(userId(jwt), page, size, search, role));
  }

  @PostMapping("/riders")
  public ResponseEntity<AdminUserService.UserResponse> createRider(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody AdminUserService.CreateRiderRequest request) {

    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(users.createRider(userId(jwt), request));
  }

  @PatchMapping("/{id}/enabled")
  public ResponseEntity<AdminUserService.UserResponse> updateEnabled(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody AdminUserService.EnabledRequest request) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(users.updateEnabled(userId(jwt), id, request));
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