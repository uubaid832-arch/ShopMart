package com.shopmart.api.auth;

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
@RequestMapping("/api/mobile/profile")
public class MobileProfileController {

  private final AuthService auth;
  private final UserAccountRepository users;

  public MobileProfileController(
      AuthService auth,
      UserAccountRepository users) {
    this.auth = auth;
    this.users = users;
  }

  @GetMapping
  public ResponseEntity<AuthService.UserResponse> get(
      @AuthenticationPrincipal Jwt jwt) {

    UserAccount user = users.findById(userId(jwt))
        .filter(UserAccount::isEnabled)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(AuthService.toResponse(user));
  }

  @PatchMapping
  public ResponseEntity<AuthService.UserResponse> update(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody AuthService.UpdateProfileRequest request) {

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(auth.updateProfile(userId(jwt), request));
  }

  private static UUID userId(Jwt jwt) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    try {
      return UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException failure) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
  }
}