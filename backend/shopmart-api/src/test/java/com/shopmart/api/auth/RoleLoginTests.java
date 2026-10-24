package com.shopmart.api.auth;

import jakarta.persistence.EntityManager;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RoleLoginTests {
  private EmailOtpService otp;
  private UserAccount user;
  private RefreshSessionService sessions;
  private OtpMailService mail;
  private UUID userId;
  private final LoginService.LoginRequest request = new LoginService.LoginRequest("person@gmail.com", "password-123");

  @BeforeEach void setup() {
    EntityManager entityManager = mock(EntityManager.class);
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    UserAccountRepository users = mock(UserAccountRepository.class);
    LoginService login = mock(LoginService.class);
    sessions = mock(RefreshSessionService.class);
    mail = mock(OtpMailService.class);
    user = mock(UserAccount.class);
    userId = UUID.randomUUID();
    when(user.getId()).thenReturn(userId);
    when(user.isEnabled()).thenReturn(true);
    when(user.getPasswordHash()).thenReturn("existing-password-hash");
    when(user.getEmail()).thenReturn(request.email());
    when(login.authenticate(request)).thenReturn(user);
    when(users.lockById(userId)).thenReturn(Optional.of(user));
    otp = new EmailOtpService(entityManager, jdbc, users, login, sessions,
        mock(RefreshSessionRepository.class), mock(PasswordEncoder.class),
        new OtpCrypto("test-only-key-with-at-least-32-bytes"), mock(OtpRateLimiter.class), mail);
  }

  @Test void customerGetsSessionWithoutSendingCode() {
    when(user.getRole()).thenReturn("CUSTOMER");
    var expected = new RefreshSessionService.SessionTokens(null, "refresh", java.time.Instant.now());
    when(sessions.create(userId)).thenReturn(expected);
    var result = otp.startLogin(request, EmailOtpService.WEB, "test-ip");
    assertNull(result.challenge());
    assertSame(expected, result.session());
    verify(mail, never()).send(anyString(), anyString(), anyBoolean());
  }

  @ParameterizedTest
  @ValueSource(strings = {"RIDER", "ADMIN"})
  void staffGetChallengeWithoutSession(String role) {
    when(user.getRole()).thenReturn(role);
    var result = otp.startLogin(request, EmailOtpService.WEB, "test-ip");
    assertNotNull(result.challenge());
    assertNull(result.session());
    verify(sessions, never()).create(any());
    verify(mail).send(eq(request.email()), matches("[0-9]{6}"), eq(false));
  }

  @Test void mobileCustomerAlsoSignsInWithoutOtp() {
    when(user.getRole()).thenReturn("CUSTOMER");
    var expected = new RefreshSessionService.SessionTokens(null, "refresh", java.time.Instant.now());
    when(sessions.create(userId)).thenReturn(expected);
    assertSame(expected, otp.startLogin(request, EmailOtpService.MOBILE, "test-ip").session());
    verify(mail, never()).send(anyString(), anyString(), anyBoolean());
  }
}
