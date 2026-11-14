package com.shopmart.api.admin;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminStoreSettingsService {

  private final JdbcTemplate jdbc;

  public AdminStoreSettingsService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public WarehouseAddress get(UUID adminId) {
    requireAdmin(adminId);
    return jdbc.queryForObject("""
        SELECT warehouse_return_address
        FROM public.store_settings
        WHERE id = 1
        """, (rs, row) -> new WarehouseAddress(
            rs.getString("warehouse_return_address")));
  }

  @Transactional
  public WarehouseAddress update(UUID adminId, WarehouseAddressRequest request) {
    requireAdmin(adminId);
    String address = request.address().strip();
    if (address.length() < 10) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Enter the full warehouse address, city, and contact details.");
    }
    jdbc.update("""
        INSERT INTO public.store_settings (
            id, warehouse_return_address, updated_by, updated_at)
        VALUES (1, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
            warehouse_return_address = EXCLUDED.warehouse_return_address,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP
        """, address, adminId);
    return new WarehouseAddress(address);
  }

  private void requireAdmin(UUID adminId) {
    Boolean allowed = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = ? AND enabled = TRUE AND role = 'ADMIN')
        """, Boolean.class, adminId);
    if (!Boolean.TRUE.equals(allowed)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Administrator access is required.");
    }
  }

  public record WarehouseAddress(String address) {}

  public record WarehouseAddressRequest(
      @NotBlank @Size(max = 1500) String address) {}
}
