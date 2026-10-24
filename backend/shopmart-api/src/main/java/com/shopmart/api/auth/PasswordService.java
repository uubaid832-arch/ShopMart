package com.shopmart.api.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;

@Service
@Validated
public class PasswordService {

  private final UserAccountRepository users;
  private final RefreshSessionRepository sessions;
  private final PasswordEncoder passwordEncoder;

  public PasswordService(
      UserAccountRepository users,
      RefreshSessionRepository sessions,
      PasswordEncoder passwordEncoder) {
    this.users = users;
    this.sessions = sessions;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public void change(
      UUID userId,
      @Valid ChangePasswordRequest request) {

    validatePasswordLength(request.currentPassword());
    validatePasswordLength(request.newPassword());

    UserAccount user = users.lockById(userId)
        .filter(UserAccount::isEnabled)
        .orElseThrow(() -> failure(
            HttpStatus.UNAUTHORIZED,
            "Please sign in again."));

    if (!passwordEncoder.matches(
        request.currentPassword(),
        user.getPasswordHash())) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "The current password is incorrect.");
    }

    replacePassword(user, request.newPassword());
  }

  @Transactional
  public void resetRider(
      UUID adminId,
      UUID riderId,
      @Valid ResetPasswordRequest request) {

    validatePasswordLength(request.newPassword());

    UserAccount admin = users.lockById(adminId)
        .filter(UserAccount::isEnabled)
        .filter(account -> "ADMIN".equals(account.getRole()))
        .orElseThrow(() -> failure(
            HttpStatus.FORBIDDEN,
            "Administrator access is required."));

    if (admin.getId().equals(riderId)) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Use your account's change-password option.");
    }

    UserAccount rider = users.lockById(riderId)
        .orElseThrow(() -> failure(
            HttpStatus.NOT_FOUND,
            "Rider account not found."));

    if (!"RIDER".equals(rider.getRole())) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Only rider passwords can be reset here.");
    }

    replacePassword(rider, request.newPassword());
  }

  private void replacePassword(UserAccount user, String newPassword) {
    if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Choose a different password from the existing password.");
    }

    user.changePasswordHash(passwordEncoder.encode(newPassword));
    users.saveAndFlush(user);

    // The account lock serializes this operation with refresh rotation.
    sessions.revokeAllForUser(user.getId(), Instant.now());
  }

  private static void validatePasswordLength(String password) {
    if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Password must not exceed 72 UTF-8 bytes.");
    }
  }

  private static ResponseStatusException failure(
      HttpStatus status,
      String message) {
    return new ResponseStatusException(status, message);
  }

  public record ChangePasswordRequest(
      @NotBlank @Size(max = 72) String currentPassword,
      @NotBlank @Size(min = 8, max = 72) String newPassword) {

    @Override
    public String toString() {
      return "ChangePasswordRequest[REDACTED]";
    }
  }

  public record ResetPasswordRequest(
      @NotBlank @Size(min = 8, max = 72) String newPassword) {

    @Override
    public String toString() {
      return "ResetPasswordRequest[REDACTED]";
    }
  }
}