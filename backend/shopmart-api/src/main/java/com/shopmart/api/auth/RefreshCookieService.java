package com.shopmart.api.auth;

import java.time.Instant;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class RefreshCookieService {

  public static final String COOKIE_NAME = "shopmart_refresh";

  private final boolean secure;

  public RefreshCookieService(
      @Value("${shopmart.auth.cookie-secure:false}") boolean secure) {
    this.secure = secure;
  }

  public void write(
      HttpServletResponse response,
      String token,
      Instant expiresAt) {
    long seconds = Math.max(
        0,
        expiresAt.getEpochSecond() - Instant.now().getEpochSecond());

    setCookie(response, token, seconds);
  }

  public void clear(HttpServletResponse response) {
    setCookie(response, "", 0);
  }

  private void setCookie(
      HttpServletResponse response,
      String value,
      long maxAge) {
    ResponseCookie cookie = ResponseCookie
        .from(COOKIE_NAME, value)
        .httpOnly(true)
        .secure(secure)
        .sameSite("Strict")
        .path("/api/auth")
        .maxAge(maxAge)
        .build();

    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }
}