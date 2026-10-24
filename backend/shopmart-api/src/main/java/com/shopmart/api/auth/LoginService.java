package com.shopmart.api.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LoginService {

  private final UserAccountRepository users;
  private final PasswordEncoder passwordEncoder;
  private final String dummyPasswordHash;

  public LoginService(
      UserAccountRepository users,
      PasswordEncoder passwordEncoder) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
    this.dummyPasswordHash = passwordEncoder.encode(
        "Unused account lookup timing value");
  }

  @Transactional(readOnly = true)
  public UserAccount authenticate(LoginRequest request) {
    String email = request.email().strip().toLowerCase(Locale.ROOT);

    if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
      throw invalidCredentials();
    }

    UserAccount user = users.findByEmail(email).orElse(null);

    String hash = user == null
        ? dummyPasswordHash
        : user.getPasswordHash();

    boolean passwordMatches = passwordEncoder.matches(
        request.password(),
        hash);

    if (user == null || !passwordMatches || !user.isEnabled()) {
      throw invalidCredentials();
    }

    return user;
  }

  private static ResponseStatusException invalidCredentials() {
    return new ResponseStatusException(
        HttpStatus.UNAUTHORIZED,
        "Invalid email or password.");
  }

  public record LoginRequest(
      @NotBlank @Email @Size(max = 254) String email,

      @NotBlank @Size(max = 72) String password) {
    @Override
    public String toString() {
      return "LoginRequest[REDACTED]";
    }
  }

  public record LoginResponse(
      String accessToken,
      String tokenType,
      long expiresIn,
      AuthService.UserResponse user) {
    @Override
    public String toString() {
      return "LoginResponse[REDACTED]";
    }
  }
}