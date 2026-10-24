package com.shopmart.api.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

  private final UserAccountRepository users;
  private final PasswordEncoder passwordEncoder;

  public AuthService(
      UserAccountRepository users,
      PasswordEncoder passwordEncoder) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public UserResponse register(RegisterRequest request) {
    String name = request.name().strip();
    String email = request.email().strip().toLowerCase(Locale.ROOT);

    if (name.isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Please enter your name.");
    }

    // BCrypt supports passwords up to 72 UTF-8 bytes.
    if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Password must not exceed 72 UTF-8 bytes.");
    }

    if (users.existsByEmail(email)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "An account with this email already exists.");
    }

    UserAccount user = new UserAccount(
        name,
        email,
        passwordEncoder.encode(request.password()));

    return toResponse(users.saveAndFlush(user));
  }

  static UserResponse toResponse(UserAccount user) {
    return new UserResponse(
        user.getId(),
        user.getName(),
        user.getEmail(),
        user.getRole(),
        user.getPhone());
  }

  public record RegisterRequest(
      @NotBlank @Size(max = 150) String name,

      @NotBlank @Email @Size(max = 254) String email,

      @NotBlank @Size(min = 8, max = 72) String password) {
    @Override
    public String toString() {
      return "RegisterRequest[REDACTED]";
    }
  }

  public record UpdateProfileRequest(
      @NotBlank @Size(max = 150) String name,
      @Size(max = 32) String phone) {
  }

  public record UserResponse(
      UUID id,
      String name,
      String email,
      String role,
      String phone) {
  }

  @Transactional
  public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
    String name = request.name().strip();
    String phone = request.phone() == null ? "" : request.phone().strip();

    if (name.isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Please enter your name.");
    }

    UserAccount user = users.lockById(userId)
        .filter(UserAccount::isEnabled)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.UNAUTHORIZED, "Please sign in again."));

    user.updateProfile(name, phone.isEmpty() ? null : phone);

    return toResponse(users.saveAndFlush(user));
  }
}