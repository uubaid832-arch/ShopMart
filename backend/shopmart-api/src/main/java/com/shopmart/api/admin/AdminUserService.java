package com.shopmart.api.admin;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;

@Service
@Validated
public class AdminUserService {

  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwordEncoder;

  public AdminUserService(
      JdbcTemplate jdbc,
      PasswordEncoder passwordEncoder) {
    this.jdbc = jdbc;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional(readOnly = true)
  public UserPage list(
      UUID adminId,
      int page,
      int size,
      String search,
      String role) {
    requireAdmin(adminId);

    if (page < 0 || size < 1 || size > 50) {
      throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
    }

    String query = search == null ? "" : search.strip();

    if (query.length() > 150) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Search must not exceed 150 characters.");
    }

    String selectedRole = role == null
        ? "ALL"
        : role.strip().toUpperCase(Locale.ROOT);

    if (!Set.of("ALL", "CUSTOMER", "RIDER", "ADMIN")
        .contains(selectedRole)) {
      throw failure(HttpStatus.BAD_REQUEST, "Invalid role filter.");
    }

    String searchValue = query.toLowerCase(Locale.ROOT);

    long total = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM public.users
        WHERE (? = 'ALL' OR role = ?)
          AND strpos(
              lower(
                  name || ' ' || email || ' ' || COALESCE(phone, '')
              ),
              ?
          ) > 0
        """,
        Long.class,
        selectedRole,
        selectedRole,
        searchValue);

    List<UserResponse> items = jdbc.query("""
        SELECT id, name, email, phone, role, enabled, version
        FROM public.users
        WHERE (? = 'ALL' OR role = ?)
          AND strpos(
              lower(
                  name || ' ' || email || ' ' || COALESCE(phone, '')
              ),
              ?
          ) > 0
        ORDER BY lower(name), id
        LIMIT ? OFFSET ?
        """,
        this::mapUser,
        selectedRole,
        selectedRole,
        searchValue,
        size,
        (long) page * size);

    return new UserPage(
        items,
        page,
        size,
        total,
        (int) ((total + size - 1) / size));
  }

  @Transactional
  public UserResponse createRider(
      UUID adminId,
      @Valid CreateRiderRequest request) {
    requireAdmin(adminId);

    String name = request.name().strip();
    String email = request.email().strip().toLowerCase(Locale.ROOT);
    String phone = request.phone() == null
        ? ""
        : request.phone().strip();

    if (name.isBlank()) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Please enter the rider's name.");
    }

    if (request.password()
        .getBytes(StandardCharsets.UTF_8).length > 72) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Password must not exceed 72 UTF-8 bytes.");
    }

    Boolean exists = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1
            FROM public.users
            WHERE lower(email) = ?
        )
        """, Boolean.class, email);

    if (Boolean.TRUE.equals(exists)) {
      throw duplicateEmail();
    }

    UUID id = UUID.randomUUID();

    try {
      jdbc.update("""
          INSERT INTO public.users (
              id, name, email, password_hash, phone,
              role, enabled, version
          )
          VALUES (?, ?, ?, ?, ?, 'RIDER', TRUE, 0)
          """,
          id,
          name,
          email,
          passwordEncoder.encode(request.password()),
          phone.isEmpty() ? null : phone);
    } catch (DuplicateKeyException exception) {
      throw duplicateEmail();
    }

    return find(id);
  }

  @Transactional
  public UserResponse updateEnabled(
      UUID adminId,
      UUID userId,
      @Valid EnabledRequest request) {
    requireAdmin(adminId);

    var matches = jdbc.queryForList("""
        SELECT role, enabled, version
        FROM public.users
        WHERE id = ?
        FOR UPDATE
        """, userId);

    if (matches.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "User not found.");
    }

    var user = matches.get(0);
    String role = (String) user.get("role");

    // Administrator accounts cannot be changed through this module.
    if (adminId.equals(userId) || "ADMIN".equals(role)) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Administrator accounts cannot be enabled or disabled here.");
    }

    if (!Set.of("CUSTOMER", "RIDER").contains(role)) {
      throw failure(
          HttpStatus.CONFLICT,
          "This account role cannot be managed here.");
    }

    long version = ((Number) user.get("version")).longValue();

    if (version != request.version()) {
      throw failure(
          HttpStatus.CONFLICT,
          "This account changed. Refresh the list before trying again.");
    }

    boolean currentEnabled = Boolean.TRUE.equals(user.get("enabled"));

    if (currentEnabled == request.enabled()) {
      return find(userId);
    }

    if (!request.enabled() && "RIDER".equals(role)) {
      Boolean activeDeliveries = jdbc.queryForObject("""
          SELECT EXISTS (
              SELECT 1
              FROM public.delivery_assignments a
              JOIN public.orders o ON o.id = a.order_id
              WHERE a.rider_id = ?
                AND o.status IN ('CONFIRMED', 'DISPATCHED')
          )
          """, Boolean.class, userId);

      if (Boolean.TRUE.equals(activeDeliveries)) {
        throw failure(
            HttpStatus.CONFLICT,
            "This rider has active deliveries."
                + " Reassign confirmed orders or resolve dispatched deliveries first.");
      }
    }

    jdbc.update("""
        UPDATE public.users
        SET enabled = ?,
            version = version + 1
        WHERE id = ?
        """, request.enabled(), userId);

    return find(userId);
  }

  private UserResponse find(UUID id) {
    return jdbc.queryForObject("""
        SELECT id, name, email, phone, role, enabled, version
        FROM public.users
        WHERE id = ?
        """, this::mapUser, id);
  }

  private UserResponse mapUser(
      ResultSet rs,
      int row) throws SQLException {
    return new UserResponse(
        rs.getObject("id", UUID.class),
        rs.getString("name"),
        rs.getString("email"),
        rs.getString("phone"),
        rs.getString("role"),
        rs.getBoolean("enabled"),
        rs.getLong("version"));
  }

  private void requireAdmin(UUID adminId) {
    Boolean allowed = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1
            FROM public.users
            WHERE id = ?
              AND role = 'ADMIN'
              AND enabled = TRUE
        )
        """, Boolean.class, adminId);

    if (!Boolean.TRUE.equals(allowed)) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Administrator access is required.");
    }
  }

  private static ResponseStatusException duplicateEmail() {
    return failure(
        HttpStatus.CONFLICT,
        "An account with this email already exists.");
  }

  private static ResponseStatusException failure(
      HttpStatus status,
      String message) {
    return new ResponseStatusException(status, message);
  }

  public record CreateRiderRequest(
      @NotBlank @Size(max = 150) String name,
      @NotBlank @Email @Size(max = 254) String email,
      @Size(max = 32) String phone,
      @NotBlank @Size(min = 8, max = 72) String password) {

    @Override
    public String toString() {
      return "CreateRiderRequest[REDACTED]";
    }
  }

  public record EnabledRequest(
      @NotNull Boolean enabled,
      @NotNull @Min(0) Long version) {
  }

  public record UserResponse(
      UUID id,
      String name,
      String email,
      String phone,
      String role,
      boolean enabled,
      long version) {
  }

  public record UserPage(
      List<UserResponse> items,
      int page,
      int size,
      long totalItems,
      int totalPages) {
  }
}