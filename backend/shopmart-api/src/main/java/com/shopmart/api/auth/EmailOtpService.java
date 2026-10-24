package com.shopmart.api.auth;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmailOtpService {
  public static final String WEB = "LOGIN_WEB";
  public static final String MOBILE = "LOGIN_MOBILE";
  private static final String RESET = "RESET";
  private final EntityManager entityManager;
  private final JdbcTemplate jdbc;
  private final UserAccountRepository users;
  private final LoginService login;
  private final RefreshSessionService sessions;
  private final RefreshSessionRepository refreshSessions;
  private final PasswordEncoder passwords;
  private final OtpCrypto crypto;
  private final OtpRateLimiter rates;
  private final OtpMailService mail;

  public EmailOtpService(EntityManager entityManager, JdbcTemplate jdbc, UserAccountRepository users, LoginService login,
      RefreshSessionService sessions, RefreshSessionRepository refreshSessions,
      PasswordEncoder passwords, OtpCrypto crypto, OtpRateLimiter rates, OtpMailService mail) {
    this.entityManager = entityManager;
    this.jdbc = jdbc;
    this.users = users;
    this.login = login;
    this.sessions = sessions;
    this.refreshSessions = refreshSessions;
    this.passwords = passwords;
    this.crypto = crypto;
    this.rates = rates;
    this.mail = mail;
  }

  @Transactional
  public LoginStart startLogin(LoginService.LoginRequest request, String purpose, String ip) {
    String email = normalize(request.email());
    requestLimits(email, ip);
    UserAccount authenticated = login.authenticate(request);
    String authenticatedHash = authenticated.getPasswordHash();
    UserAccount user = users.lockById(authenticated.getId()).filter(UserAccount::isEnabled)
        .orElseThrow(EmailOtpService::denied);
    entityManager.refresh(user);
    // A password reset between credential verification and the account lock cancels this login.
    if (!user.getPasswordHash().equals(authenticatedHash)) throw denied();
    if ("CUSTOMER".equals(user.getRole())) {
      return new LoginStart(null, sessions.create(user.getId()));
    }
    if (!"RIDER".equals(user.getRole()) && !"ADMIN".equals(user.getRole())) throw denied();
    return new LoginStart(issue(user, email, purpose), null);
  }

  @Transactional
  public ChallengeResponse forgot(EmailRequest request, String ip) {
    String email = normalize(request.email());
    requestLimits(email, ip);
    UserAccount found = users.findByEmail(email).orElse(null);
    UserAccount user = found == null ? null : users.lockById(found.getId()).orElse(null);
    if (!recoverable(user)) user = null;
    // Unknown, disabled and admin accounts get the same-shaped decoy challenge.
    return issue(user, email, RESET);
  }

  private ChallengeResponse issue(UserAccount user, String email, String purpose) {
    String recipient = crypto.digest("email:" + email);
    sendLimits(recipient);
    if (user != null) {
      jdbc.update("UPDATE public.email_otp_challenges SET consumed = TRUE WHERE user_id = ? AND purpose = ?",
          user.getId(), purpose);
    }
    UUID id = UUID.randomUUID();
    String code = crypto.code();
    Instant now = Instant.now();
    Instant expires = now.plusSeconds(300);
    Instant resend = now.plusSeconds(60);
    jdbc.update("""
        INSERT INTO public.email_otp_challenges
          (id, user_id, purpose, recipient_key, password_stamp, code_digest, expires_at, resend_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, id, user == null ? null : user.getId(), purpose, recipient,
        user == null ? null : stamp(user), crypto.codeDigest(id, purpose, code),
        Timestamp.from(expires), Timestamp.from(resend));
    if (user != null) mail.send(user.getEmail(), code, RESET.equals(purpose));
    return new ChallengeResponse(id, expires, resend);
  }

  @Transactional(noRollbackFor = OtpDeniedException.class)
  public RefreshSessionService.SessionTokens verifyLogin(VerifyRequest request, String purpose, String ip) {
    verifyIpLimit(ip);
    Challenge challenge = locked(request.challengeId());
    UserAccount user = verify(challenge, request.code(), purpose);
    consume(challenge.id());
    // The same transaction holds the user lock until both OTP consumption and session creation commit.
    return sessions.create(user.getId());
  }

  @Transactional(noRollbackFor = OtpDeniedException.class)
  public void reset(ResetRequest request, String ip) {
    verifyIpLimit(ip);
    if (request.newPassword().getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must not exceed 72 UTF-8 bytes.");
    }
    Challenge challenge = locked(request.challengeId());
    UserAccount user = verify(challenge, request.code(), RESET);
    if (!recoverable(user)) throw denied();
    if (passwords.matches(request.newPassword(), user.getPasswordHash())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a different password.");
    }
    user.changePasswordHash(passwords.encode(request.newPassword()));
    users.saveAndFlush(user);
    refreshSessions.revokeAllForUser(user.getId(), Instant.now());
    jdbc.update("UPDATE public.email_otp_challenges SET consumed = TRUE WHERE user_id = ?", user.getId());
  }

  @Transactional(noRollbackFor = OtpDeniedException.class)
  public ChallengeResponse resend(ChallengeRequest request, String expectedPurpose, String ip) {
    rates.take("resend-ip:" + ip, 30, Duration.ofMinutes(15));
    Challenge challenge = locked(request.challengeId());
    if (challenge == null || challenge.consumed() || challenge.attempts() >= 5
        || !challenge.expiresAt().isAfter(Instant.now())
        || !challenge.purpose().equals(expectedPurpose)) throw denied();
    if (challenge.resendAt().isAfter(Instant.now())) throw new OtpRateLimiter.RateLimitedException();
    sendLimits(challenge.recipientKey());
    UserAccount user = challenge.userId() == null ? null : users.findById(challenge.userId()).orElse(null);
    if (user != null && (!user.isEnabled() || !stamp(user).equals(challenge.passwordStamp())
        || (RESET.equals(expectedPurpose) && !recoverable(user)))) {
      consume(challenge.id());
      throw denied();
    }
    String code = crypto.code();
    Instant now = Instant.now();
    // Keep the original expiry and attempt count: resending cannot extend a guessing window.
    Instant resend = now.plusSeconds(60);
    jdbc.update("UPDATE public.email_otp_challenges SET code_digest = ?, resend_at = ? WHERE id = ?",
        crypto.codeDigest(challenge.id(), expectedPurpose, code), Timestamp.from(resend), challenge.id());
    if (user != null) mail.send(user.getEmail(), code, RESET.equals(expectedPurpose));
    return new ChallengeResponse(challenge.id(), challenge.expiresAt(), resend);
  }

  private UserAccount verify(Challenge challenge, String code, String purpose) {
    if (challenge == null || challenge.consumed() || challenge.attempts() >= 5
        || !challenge.expiresAt().isAfter(Instant.now()) || !purpose.equals(challenge.purpose())) throw denied();
    rates.take("verify-email:" + challenge.recipientKey(), 20, Duration.ofMinutes(15));
    jdbc.update("UPDATE public.email_otp_challenges SET attempts = attempts + 1 WHERE id = ?", challenge.id());
    boolean matches = crypto.matches(challenge.codeDigest(), crypto.codeDigest(challenge.id(), purpose, code));
    UserAccount user = challenge.userId() == null ? null : users.findById(challenge.userId()).orElse(null);
    if (!matches || user == null || !user.isEnabled() || !stamp(user).equals(challenge.passwordStamp())) {
      throw denied();
    }
    return user;
  }

  private Challenge locked(UUID id) {
    // Always lock the account before the challenge, matching password changes and refresh rotation.
    var rows = jdbc.query("SELECT * FROM public.email_otp_challenges WHERE id = ?", this::row, id);
    if (rows.isEmpty()) return null;
    UUID userId = rows.get(0).userId();
    if (userId != null) {
      UserAccount account = users.lockById(userId).orElseThrow(EmailOtpService::denied);
      entityManager.refresh(account);
    }
    var locked = jdbc.query("SELECT * FROM public.email_otp_challenges WHERE id = ? FOR UPDATE", this::row, id);
    return locked.isEmpty() ? null : locked.get(0);
  }

  private Challenge row(ResultSet rs, int rowNumber) throws SQLException {
    return new Challenge(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
        rs.getString("purpose"), rs.getString("recipient_key"), rs.getString("password_stamp"),
        rs.getString("code_digest"), rs.getInt("attempts"), rs.getTimestamp("expires_at").toInstant(),
        rs.getTimestamp("resend_at").toInstant(), rs.getBoolean("consumed"));
  }

  private void requestLimits(String email, String ip) {
    rates.take("request-ip:" + ip, 30, Duration.ofMinutes(15));
    rates.take("request-email:" + email, 10, Duration.ofMinutes(15));
  }

  private void sendLimits(String recipient) {
    rates.take("mail-window:" + recipient, 5, Duration.ofMinutes(15));
    rates.take("mail-cooldown:" + recipient, 1, Duration.ofSeconds(60));
  }

  private void verifyIpLimit(String ip) {
    rates.take("verify-ip:" + ip, 60, Duration.ofMinutes(15));
  }

  private String stamp(UserAccount user) { return crypto.digest("password:" + user.getPasswordHash()); }
  private static String normalize(String email) { return email.strip().toLowerCase(Locale.ROOT); }
  private static boolean recoverable(UserAccount user) {
    return user != null && user.isEnabled()
        && ("CUSTOMER".equals(user.getRole()) || "RIDER".equals(user.getRole()));
  }
  private void consume(UUID id) { jdbc.update("UPDATE public.email_otp_challenges SET consumed = TRUE WHERE id = ?", id); }
  private static OtpDeniedException denied() { return new OtpDeniedException(); }

  private record Challenge(UUID id, UUID userId, String purpose, String recipientKey, String passwordStamp,
      String codeDigest, int attempts, Instant expiresAt, Instant resendAt, boolean consumed) {}

  // Internal result: controllers return either the existing session format or a challenge.
  public record LoginStart(ChallengeResponse challenge, RefreshSessionService.SessionTokens session) {
    @Override public String toString() { return "LoginStart[REDACTED]"; }
  }

  public record ChallengeResponse(UUID challengeId, Instant expiresAt, Instant resendAt) {}
  public record EmailRequest(@NotBlank @Email @Size(max = 254) String email) {}
  public record ChallengeRequest(@NotNull UUID challengeId) {}
  public record VerifyRequest(@NotNull UUID challengeId, @NotBlank @Pattern(regexp = "[0-9]{6}") String code) {
    @Override public String toString() { return "VerifyRequest[REDACTED]"; }
  }
  public record ResetRequest(@NotNull UUID challengeId, @NotBlank @Pattern(regexp = "[0-9]{6}") String code,
      @NotBlank @Size(min = 8, max = 72) String newPassword) {
    @Override public String toString() { return "ResetRequest[REDACTED]"; }
  }
  public static class OtpDeniedException extends ResponseStatusException {
    public OtpDeniedException() { super(HttpStatus.BAD_REQUEST, "Invalid or expired verification code. Request a new code."); }
  }
}
