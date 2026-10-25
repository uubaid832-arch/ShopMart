package com.shopmart.api.auth;

import java.util.UUID;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class PasswordController {

  private final PasswordService passwords;
  private final RefreshCookieService cookies;

  public PasswordController(
      PasswordService passwords,
      RefreshCookieService cookies) {
    this.passwords = passwords;
    this.cookies = cookies;
  }

  @PatchMapping("/api/auth/password")
  public ResponseEntity<Void> change(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody PasswordService.ChangePasswordRequest request,
      HttpServletResponse response) {

    passwords.change(userId(jwt), request);
    cookies.clear(response);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @PatchMapping("/api/mobile/profile/password")
  public ResponseEntity<Void> changeMobile(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody PasswordService.ChangePasswordRequest request) {

    passwords.change(userId(jwt), request);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @PatchMapping("/api/admin/users/{id}/password")
  public ResponseEntity<Void> resetRider(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody PasswordService.ResetPasswordRequest request) {

    passwords.resetRider(userId(jwt), id, request);

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