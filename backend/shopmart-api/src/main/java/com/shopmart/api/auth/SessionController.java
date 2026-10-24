package com.shopmart.api.auth;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class SessionController {

  private final RefreshSessionService sessions;
  private final RefreshCookieService cookies;

  public SessionController(
      RefreshSessionService sessions,
      RefreshCookieService cookies) {
    this.sessions = sessions;
    this.cookies = cookies;
  }

  @GetMapping("/csrf")
  public ResponseEntity<CsrfResponse> csrf(CsrfToken token) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(new CsrfResponse(
            token.getHeaderName(),
            token.getToken()));
  }

  @PostMapping("/refresh")
  public ResponseEntity<LoginService.LoginResponse> refresh(
      @CookieValue(name = RefreshCookieService.COOKIE_NAME, required = false) String refreshToken,
      HttpServletResponse response) {
    try {
      RefreshSessionService.SessionTokens result = sessions.rotate(refreshToken);

      cookies.write(
          response,
          result.refreshToken(),
          result.refreshExpiresAt());

      return ResponseEntity.ok()
          .cacheControl(CacheControl.noStore())
          .body(result.login());
    } catch (RefreshSessionService.RefreshDeniedException exception) {
      cookies.clear(response);
      throw exception;
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @CookieValue(name = RefreshCookieService.COOKIE_NAME, required = false) String refreshToken,
      HttpServletResponse response) {
    sessions.revoke(refreshToken);
    cookies.clear(response);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  public record CsrfResponse(String headerName, String token) {
  }
}