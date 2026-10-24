package com.shopmart.api.auth;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Run against a dedicated test database containing the project's schema and 009_email_otp.sql.
// No @Transactional: failed attempts must commit to exercise replay/lockout protection.
@SpringBootTest(properties = {
    "shopmart.otp.secret=test-only-secret-with-at-least-32-bytes",
    "spring.mail.username=test@example.invalid",
    "spring.mail.password=test-only",
    "shopmart.activity-mail.enabled=false"
})
class EmailOtpIntegrationTests {
  @Autowired EmailOtpService otp;
  @Autowired AuthService auth;
  @Autowired PasswordService passwords;
  @Autowired LoginService login;
  @Autowired RefreshSessionService sessions;
  @Autowired JdbcTemplate jdbc;
  @MockitoBean OtpMailService mail;
  final AtomicReference<String> code = new AtomicReference<>();
  String email;
  String ip;
  UUID userId;
  final String originalPassword = "Original-password-123!";

  @BeforeEach
  void setup() {
    String suffix = UUID.randomUUID().toString();
    email = suffix + "@example.invalid";
    ip = "test-" + suffix;
    userId = auth.register(new AuthService.RegisterRequest("OTP test", email, originalPassword)).id();
    jdbc.update("UPDATE public.users SET role = 'RIDER' WHERE id = ?", userId);
    doAnswer(call -> { code.set(call.getArgument(1)); return null; })
        .when(mail).send(eq(email), anyString(), anyBoolean());
  }

  @AfterEach
  void cleanup() {
    if (userId == null) return;
    jdbc.update("DELETE FROM public.email_otp_challenges WHERE user_id = ?", userId);
    jdbc.update("DELETE FROM public.refresh_sessions WHERE user_id = ?", userId);
    jdbc.update("DELETE FROM public.users WHERE id = ?", userId);
  }

  @Test void customerSignsInWithoutOtp() {
    jdbc.update("UPDATE public.users SET role = 'CUSTOMER' WHERE id = ?", userId);
    var result = otp.startLogin(new LoginService.LoginRequest(email, originalPassword), EmailOtpService.WEB, ip);
    assertNull(result.challenge());
    assertEquals(userId, result.session().login().user().id());
    verify(mail, never()).send(anyString(), anyString(), anyBoolean());
  }

  EmailOtpService.ChallengeResponse start(String purpose) {
    return otp.startLogin(new LoginService.LoginRequest(email, originalPassword), purpose, ip).challenge();
  }

  @Test void passwordStepDoesNotCreateSessionAndCodeWorksOnlyOnce() {
    var challenge = start(EmailOtpService.WEB);
    assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM public.refresh_sessions WHERE user_id = ?", Integer.class, userId));
    var request = new EmailOtpService.VerifyRequest(challenge.challengeId(), code.get());
    var session = otp.verifyLogin(request, EmailOtpService.WEB, ip);
    assertEquals(userId, session.login().user().id());
    assertThrows(EmailOtpService.OtpDeniedException.class,
        () -> otp.verifyLogin(request, EmailOtpService.WEB, ip));
  }

  @Test void incorrectCodesPersistAndLockAfterFiveAttempts() {
    var challenge = start(EmailOtpService.WEB);
    String valid = code.get();
    String invalid = valid.equals("000000") ? "111111" : "000000";
    for (int i = 0; i < 5; i++) {
      assertThrows(EmailOtpService.OtpDeniedException.class, () -> otp.verifyLogin(
          new EmailOtpService.VerifyRequest(challenge.challengeId(), invalid), EmailOtpService.WEB, ip));
    }
    assertEquals(5, jdbc.queryForObject("SELECT attempts FROM public.email_otp_challenges WHERE id = ?", Integer.class, challenge.challengeId()));
    assertThrows(EmailOtpService.OtpDeniedException.class, () -> otp.verifyLogin(
        new EmailOtpService.VerifyRequest(challenge.challengeId(), valid), EmailOtpService.WEB, ip));
  }

  @Test void expiredCodeCannotSignIn() {
    var challenge = start(EmailOtpService.WEB);
    jdbc.update("UPDATE public.email_otp_challenges SET expires_at = ? WHERE id = ?",
        Timestamp.from(Instant.now().minusSeconds(1)), challenge.challengeId());
    assertThrows(EmailOtpService.OtpDeniedException.class, () -> otp.verifyLogin(
        new EmailOtpService.VerifyRequest(challenge.challengeId(), code.get()), EmailOtpService.WEB, ip));
  }

  @ParameterizedTest
  @ValueSource(strings = {"ADMIN", "RIDER"})
  void adminAndRiderStillRequireOtp(String role) {
    jdbc.update("UPDATE public.users SET role = ? WHERE id = ?", role, userId);
    var challenge = start(EmailOtpService.WEB);
    assertNotNull(challenge.challengeId());
    assertEquals(role, otp.verifyLogin(new EmailOtpService.VerifyRequest(challenge.challengeId(), code.get()),
        EmailOtpService.WEB, ip).login().user().role());
  }

  @Test void mobileChallengeCannotBeUsedOnWeb() {
    var challenge = start(EmailOtpService.MOBILE);
    assertThrows(EmailOtpService.OtpDeniedException.class, () -> otp.verifyLogin(
        new EmailOtpService.VerifyRequest(challenge.challengeId(), code.get()), EmailOtpService.WEB, ip));
    assertEquals(userId, otp.verifyLogin(new EmailOtpService.VerifyRequest(challenge.challengeId(), code.get()),
        EmailOtpService.MOBILE, ip).login().user().id());
  }

  @Test void resetChangesPasswordRevokesSessionsAndCannotBeReplayed() {
    sessions.create(userId);
    var challenge = otp.forgot(new EmailOtpService.EmailRequest(email), ip);
    String resetCode = code.get();
    var request = new EmailOtpService.ResetRequest(challenge.challengeId(), resetCode, "Changed-password-456!");
    otp.reset(request, ip);
    assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM public.refresh_sessions WHERE user_id = ? AND revoked_at IS NULL", Integer.class, userId));
    assertThrows(EmailOtpService.OtpDeniedException.class, () -> otp.reset(request, ip));
    assertThrows(org.springframework.web.server.ResponseStatusException.class,
        () -> login.authenticate(new LoginService.LoginRequest(email, originalPassword)));
    assertEquals(userId, login.authenticate(new LoginService.LoginRequest(email, "Changed-password-456!")).getId());
  }

  @Test void passwordChangeInvalidatesPendingLoginCode() {
    var challenge = start(EmailOtpService.WEB);
    passwords.change(userId, new PasswordService.ChangePasswordRequest(originalPassword, "Changed-password-456!"));
    assertThrows(EmailOtpService.OtpDeniedException.class, () -> otp.verifyLogin(
        new EmailOtpService.VerifyRequest(challenge.challengeId(), code.get()), EmailOtpService.WEB, ip));
  }

  @Test void resendIsBlockedDuringCooldown() {
    var challenge = start(EmailOtpService.WEB);
    assertThrows(OtpRateLimiter.RateLimitedException.class, () -> otp.resend(
        new EmailOtpService.ChallengeRequest(challenge.challengeId()), EmailOtpService.WEB, ip));
  }

  @Test void unknownRecoveryAccountGetsDecoyAndNoEmail() {
    String unknown = UUID.randomUUID() + "@example.invalid";
    var challenge = otp.forgot(new EmailOtpService.EmailRequest(unknown), ip);
    assertNotNull(challenge.challengeId());
    verify(mail, never()).send(eq(unknown), anyString(), anyBoolean());
    assertThrows(EmailOtpService.OtpDeniedException.class, () -> otp.reset(
        new EmailOtpService.ResetRequest(challenge.challengeId(), "000000", "Changed-password-456!"), ip));
  }

  @Test void adminCannotUsePublicPasswordRecovery() {
    jdbc.update("UPDATE public.users SET role = 'ADMIN' WHERE id = ?", userId);
    otp.forgot(new EmailOtpService.EmailRequest(email), ip);
    verify(mail, never()).send(eq(email), anyString(), anyBoolean());
  }
  @Test void concurrentCodeSubmissionsCreateOnlyOneSession() throws Exception {
    var challenge = start(EmailOtpService.WEB);
    var request = new EmailOtpService.VerifyRequest(challenge.challengeId(), code.get());
    var gate = new java.util.concurrent.CountDownLatch(1);
    var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
    java.util.concurrent.Callable<Boolean> attempt = () -> {
      gate.await();
      try { otp.verifyLogin(request, EmailOtpService.WEB, ip); return true; }
      catch (EmailOtpService.OtpDeniedException expected) { return false; }
    };
    try {
      var first = pool.submit(attempt);
      var second = pool.submit(attempt);
      gate.countDown();
      int successes = (first.get(20, java.util.concurrent.TimeUnit.SECONDS) ? 1 : 0)
          + (second.get(20, java.util.concurrent.TimeUnit.SECONDS) ? 1 : 0);
      assertEquals(1, successes);
      assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM public.refresh_sessions WHERE user_id = ?", Integer.class, userId));
    } finally { pool.shutdownNow(); }
  }

}
