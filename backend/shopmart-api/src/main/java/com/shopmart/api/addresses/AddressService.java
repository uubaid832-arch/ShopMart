package com.shopmart.api.addresses;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static com.shopmart.api.addresses.AddressModels.*;

@Service
public class AddressService {

  private final JdbcTemplate jdbc;

  public AddressService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public List<AddressResponse> list(UUID userId) {
    requireUser(userId, false);

    return jdbc.query("""
        SELECT *
        FROM public.customer_addresses
        WHERE user_id = ?
        ORDER BY is_default DESC, created_at DESC, id
        """, AddressService::mapAddress, userId);
  }

  @Transactional
  public AddressResponse create(UUID userId, AddressRequest request) {
    requireUser(userId, true);

    Long count = jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM public.customer_addresses
        WHERE user_id = ?
        """, Long.class, userId);

    boolean makeDefault = request.isDefault() || count == 0;

    if (makeDefault)
      clearDefault(userId);

    UUID id = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.customer_addresses (
            id, user_id, label, recipient_name, phone,
            address_line, city, postal_code, country, is_default
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        id, userId,
        request.label().strip(),
        request.recipientName().strip(),
        request.phone().strip(),
        request.addressLine().strip(),
        request.city().strip(),
        postalCode(request.postalCode()),
        request.country(),
        makeDefault);

    return find(userId, id);
  }

  @Transactional
  public AddressResponse update(
      UUID userId, UUID id, AddressRequest request) {
    requireUser(userId, true);

    // Check ownership before changing any defaults.
    find(userId, id);

    if (request.isDefault())
      clearDefault(userId);

    jdbc.update("""
        UPDATE public.customer_addresses
        SET label = ?,
            recipient_name = ?,
            phone = ?,
            address_line = ?,
            city = ?,
            postal_code = ?,
            country = ?,
            is_default = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
        """,
        request.label().strip(),
        request.recipientName().strip(),
        request.phone().strip(),
        request.addressLine().strip(),
        request.city().strip(),
        postalCode(request.postalCode()),
        request.country(),
        request.isDefault(),
        id, userId);

    return find(userId, id);
  }

  @Transactional
  public void delete(UUID userId, UUID id) {
    requireUser(userId, true);

    int deleted = jdbc.update("""
        DELETE FROM public.customer_addresses
        WHERE id = ? AND user_id = ?
        """, id, userId);

    if (deleted == 0)
      throw notFound();
  }

  private AddressResponse find(UUID userId, UUID id) {
    return jdbc.query("""
        SELECT *
        FROM public.customer_addresses
        WHERE id = ? AND user_id = ?
        """, AddressService::mapAddress, id, userId)
        .stream()
        .findFirst()
        .orElseThrow(AddressService::notFound);
  }

  private void requireUser(UUID userId, boolean lock) {
    String sql = "SELECT enabled FROM public.users WHERE id = ?"
        + (lock ? " FOR UPDATE" : "");

    List<Boolean> users = jdbc.query(
        sql, (rs, row) -> rs.getBoolean("enabled"), userId);

    if (users.isEmpty() || !users.get(0)) {
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }
  }

  private void clearDefault(UUID userId) {
    jdbc.update("""
        UPDATE public.customer_addresses
        SET is_default = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_default = TRUE
        """, userId);
  }

  private static String postalCode(String value) {
    return value == null || value.isBlank() ? null : value.strip();
  }

  private static AddressResponse mapAddress(
      ResultSet rs, int row) throws SQLException {
    return new AddressResponse(
        rs.getObject("id", UUID.class),
        rs.getString("label"),
        rs.getString("recipient_name"),
        rs.getString("phone"),
        rs.getString("address_line"),
        rs.getString("city"),
        rs.getString("postal_code"),
        rs.getString("country"),
        rs.getBoolean("is_default"));
  }

  private static ResponseStatusException notFound() {
    return new ResponseStatusException(
        HttpStatus.NOT_FOUND, "Address not found.");
  }
}
