package com.shopmart.api.auth;

import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private final AuthService authService;
  private final EmailOtpService otp;
  private final UserAccountRepository users;
  private final RefreshCookieService cookies;

  public AuthController(
      AuthService authService,
      EmailOtpService otp,
      UserAccountRepository users,
      RefreshCookieService cookies) {
    this.authService = authService;
    this.otp = otp;
    this.users = users;
    this.cookies = cookies;
  }

  @PostMapping("/register")
  public ResponseEntity<AuthService.UserResponse> register(
      @Valid @RequestBody AuthService.RegisterRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(authService.register(request));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(
      @Valid @RequestBody LoginService.LoginRequest request, HttpServletRequest http,
      HttpServletResponse response) {
    var result = otp.startLogin(request, EmailOtpService.WEB, http.getRemoteAddr());
    if (result.session() != null) {
      var session = result.session();
      cookies.write(response, session.refreshToken(), session.refreshExpiresAt());
      return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(session.login());
    }
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result.challenge());
  }

  @PostMapping("/login/verify")
  public ResponseEntity<LoginService.LoginResponse> verifyLogin(
      @Valid @RequestBody EmailOtpService.VerifyRequest request,
      HttpServletRequest http, HttpServletResponse response) {
    var result = otp.verifyLogin(request, EmailOtpService.WEB, http.getRemoteAddr());
    cookies.write(response, result.refreshToken(), result.refreshExpiresAt());
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result.login());
  }

  @PostMapping("/login/resend")
  public ResponseEntity<EmailOtpService.ChallengeResponse> resendLogin(
      @Valid @RequestBody EmailOtpService.ChallengeRequest request, HttpServletRequest http) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(otp.resend(request, EmailOtpService.WEB, http.getRemoteAddr()));
  }

  @GetMapping("/me")
  public AuthService.UserResponse currentUser(
      @AuthenticationPrincipal Jwt jwt) {
    UUID userId;

    try {
      userId = UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    UserAccount user = users.findById(userId)
        .filter(UserAccount::isEnabled)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

    return AuthService.toResponse(user);
  }

  @PatchMapping("/me")
  public ResponseEntity<AuthService.UserResponse> updateProfile(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody AuthService.UpdateProfileRequest request) {
    UUID userId;

    try {
      userId = UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(authService.updateProfile(userId, request));
  }
}
