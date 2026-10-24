package com.shopmart.api.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RefreshSessionService {

  private static final Duration SESSION_LIFETIME = Duration.ofDays(7);

  private final RefreshSessionRepository sessions;
  private final UserAccountRepository users;
  private final TokenService tokens;
  private final SecureRandom random = new SecureRandom();

  public RefreshSessionService(
      RefreshSessionRepository sessions,
      UserAccountRepository users,
      TokenService tokens) {
    this.sessions = sessions;
    this.users = users;
    this.tokens = tokens;
  }

  @Transactional
  public SessionTokens create(UUID userId) {
    UserAccount user = users.lockById(userId)
        .filter(UserAccount::isEnabled)
        .orElseThrow(RefreshDeniedException::new);

    Instant now = Instant.now();
    String rawToken = generateToken();

    RefreshSession session = new RefreshSession(
        user.getId(),
        UUID.randomUUID(),
        hashToken(rawToken),
        now,
        now.plus(SESSION_LIFETIME));

    sessions.saveAndFlush(session);

    return response(user, rawToken, session.getExpiresAt());
  }

  @Transactional(noRollbackFor = RefreshDeniedException.class)
  public SessionTokens rotate(String rawToken) {
    String hash = hashToken(rawToken);

    if (hash == null) {
      throw new RefreshDeniedException();
    }

    UUID userId = sessions.findUserIdByTokenHash(hash)
        .orElseThrow(RefreshDeniedException::new);

    UserAccount user = users.lockById(userId)
        .orElseThrow(RefreshDeniedException::new);

    // Read the session after obtaining the account lock.
    RefreshSession previous = sessions.findByTokenHash(hash)
        .orElseThrow(RefreshDeniedException::new);

    Instant now = Instant.now();

    if (previous.getRevokedAt() != null
        || !previous.getExpiresAt().isAfter(now)
        || !user.isEnabled()) {
      sessions.revokeFamily(previous.getFamilyId(), now);
      throw new RefreshDeniedException();
    }

    String replacementToken = generateToken();

    RefreshSession replacement = new RefreshSession(
        userId,
        previous.getFamilyId(),
        hashToken(replacementToken),
        now,
        previous.getExpiresAt());

    sessions.saveAndFlush(replacement);
    previous.replaceWith(replacement.getId(), now);

    return response(
        user,
        replacementToken,
        replacement.getExpiresAt());
  }

  @Transactional
  public void revoke(String rawToken) {
    String hash = hashToken(rawToken);

    if (hash == null) {
      return;
    }

    UUID userId = sessions.findUserIdByTokenHash(hash).orElse(null);

    if (userId == null || users.lockById(userId).isEmpty()) {
      return;
    }

    sessions.findByTokenHash(hash).ifPresent(session -> sessions.revokeFamily(session.getFamilyId(), Instant.now()));
  }

  private SessionTokens response(
      UserAccount user,
      String refreshToken,
      Instant expiresAt) {
    LoginService.LoginResponse login = new LoginService.LoginResponse(
        tokens.createToken(user),
        "Bearer",
        TokenService.EXPIRES_IN_SECONDS,
        AuthService.toResponse(user));

    return new SessionTokens(login, refreshToken, expiresAt);
  }

  private String generateToken() {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);

    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(bytes);
  }

  private static String hashToken(String rawToken) {
    if (rawToken == null
        || !rawToken.matches("[A-Za-z0-9_-]{43}")) {
      return null;
    }

    try {
      byte[] digest = MessageDigest.getInstance("SHA-256")
          .digest(rawToken.getBytes(StandardCharsets.UTF_8));

      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException(
          "SHA-256 is unavailable.",
          exception);
    }
  }

  public record SessionTokens(
      LoginService.LoginResponse login,
      String refreshToken,
      Instant refreshExpiresAt) {
    @Override
    public String toString() {
      return "SessionTokens[REDACTED]";
    }
  }

  public static class RefreshDeniedException
      extends ResponseStatusException {

    public RefreshDeniedException() {
      super(HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }
  }
}