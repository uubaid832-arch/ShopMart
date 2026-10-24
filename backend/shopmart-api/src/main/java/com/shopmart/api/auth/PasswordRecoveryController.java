package com.shopmart.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class PasswordRecoveryController {
  private final EmailOtpService otp;
  private final RefreshCookieService cookies;

  public PasswordRecoveryController(EmailOtpService otp, RefreshCookieService cookies) {
    this.otp = otp;
    this.cookies = cookies;
  }

  @PostMapping({"/api/auth/password/forgot", "/api/mobile/auth/password/forgot"})
  public ResponseEntity<EmailOtpService.ChallengeResponse> forgot(
      @Valid @RequestBody EmailOtpService.EmailRequest request, HttpServletRequest http) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(otp.forgot(request, http.getRemoteAddr()));
  }

  @PostMapping({"/api/auth/password/resend", "/api/mobile/auth/password/resend"})
  public ResponseEntity<EmailOtpService.ChallengeResponse> resend(
      @Valid @RequestBody EmailOtpService.ChallengeRequest request, HttpServletRequest http) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(otp.resend(request, "RESET", http.getRemoteAddr()));
  }

  @PostMapping({"/api/auth/password/reset", "/api/mobile/auth/password/reset"})
  public ResponseEntity<Void> reset(
      @Valid @RequestBody EmailOtpService.ResetRequest request, HttpServletRequest http,
      HttpServletResponse response) {
    otp.reset(request, http.getRemoteAddr());
    // Do not attach browser cookies to the mobile API.
    if (http.getRequestURI().startsWith("/api/auth/")) {
      cookies.clear(response);
    }
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }
}
