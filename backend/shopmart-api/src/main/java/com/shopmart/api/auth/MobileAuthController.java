package com.shopmart.api.auth;

import java.time.Instant;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mobile/auth")
public class MobileAuthController {

  private final AuthService auth;
  private final EmailOtpService otp;
  private final RefreshSessionService sessions;

  public MobileAuthController(
      AuthService auth,
      EmailOtpService otp,
      RefreshSessionService sessions) {
    this.auth = auth;
    this.otp = otp;
    this.sessions = sessions;
  }

  @PostMapping("/register")
  public ResponseEntity<AuthService.UserResponse> register(
      @Valid @RequestBody AuthService.RegisterRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(auth.register(request));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(
      @Valid @RequestBody LoginService.LoginRequest request, HttpServletRequest http) {
    var result = otp.startLogin(request, EmailOtpService.MOBILE, http.getRemoteAddr());
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(result.session() == null ? result.challenge() : toResponse(result.session()));
  }

  @PostMapping("/login/verify")
  public ResponseEntity<MobileSessionResponse> verifyLogin(
      @Valid @RequestBody EmailOtpService.VerifyRequest request, HttpServletRequest http) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(toResponse(otp.verifyLogin(request, EmailOtpService.MOBILE, http.getRemoteAddr())));
  }

  @PostMapping("/login/resend")
  public ResponseEntity<EmailOtpService.ChallengeResponse> resendLogin(
      @Valid @RequestBody EmailOtpService.ChallengeRequest request, HttpServletRequest http) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(otp.resend(request, EmailOtpService.MOBILE, http.getRemoteAddr()));
  }

  @PostMapping("/refresh")
  public ResponseEntity<MobileSessionResponse> refresh(
      @Valid @RequestBody RefreshRequest request) {
    var session = sessions.rotate(request.refreshToken());

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(toResponse(session));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @Valid @RequestBody RefreshRequest request) {
    sessions.revoke(request.refreshToken());

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  private static MobileSessionResponse toResponse(
      RefreshSessionService.SessionTokens session) {
    var authenticated = session.login();

    return new MobileSessionResponse(
        authenticated.accessToken(),
        authenticated.tokenType(),
        authenticated.expiresIn(),
        authenticated.user(),
        session.refreshToken(),
        session.refreshExpiresAt());
  }

  public record RefreshRequest(
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String refreshToken) {

    @Override
    public String toString() {
      return "RefreshRequest[REDACTED]";
    }
  }

  public record MobileSessionResponse(
      String accessToken,
      String tokenType,
      long expiresIn,
      AuthService.UserResponse user,
      String refreshToken,
      Instant refreshExpiresAt) {

    @Override
    public String toString() {
      return "MobileSessionResponse[REDACTED]";
    }
  }
}