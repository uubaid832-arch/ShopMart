package com.shopmart.api.admin;

import java.util.UUID;
import java.sql.Array;
import java.util.Arrays;
import java.util.List;
import java.util.LinkedHashSet;
import java.math.BigDecimal;

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
        """, (rs, row) -> new WarehouseAddress(rs.getString("warehouse_return_address")));
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

  @Transactional(readOnly = true)
  public StoreProfile getProfile(UUID adminId) {
    requireAdmin(adminId);
    return jdbc.queryForObject("""
        SELECT operating_cities, warehouse_address_line,
               COALESCE(NULLIF(BTRIM(warehouse_city), ''), operating_cities[1], 'Lahore') AS warehouse_city,
               warehouse_phone,
               whatsapp_number, bank_name, bank_account_title, bank_account_number, bank_iban,
               delivery_fee, free_delivery_threshold, announcement_messages
        FROM public.store_settings WHERE id = 1
        """, (rs, row) -> new StoreProfile(
        textList(rs.getArray("operating_cities")), rs.getString("warehouse_address_line"),
        rs.getString("warehouse_city"), rs.getString("warehouse_phone"),
        rs.getString("whatsapp_number"), rs.getString("bank_name"),
        rs.getString("bank_account_title"), rs.getString("bank_account_number"),
        rs.getString("bank_iban"), rs.getBigDecimal("delivery_fee"),
        rs.getBigDecimal("free_delivery_threshold"), textList(rs.getArray("announcement_messages"))));
  }

  @Transactional(readOnly = true)
  public PublicStoreSettings getPublicSettings() {
    return jdbc.queryForObject("""
        SELECT operating_cities, whatsapp_number, bank_name, bank_account_title,
               bank_account_number, bank_iban, delivery_fee, free_delivery_threshold,
               announcement_messages
        FROM public.store_settings WHERE id = 1
        """, (rs, row) -> new PublicStoreSettings(
        textList(rs.getArray("operating_cities")), rs.getString("whatsapp_number"),
        rs.getString("bank_name"), rs.getString("bank_account_title"),
        rs.getString("bank_account_number"), rs.getString("bank_iban"),
        rs.getBigDecimal("delivery_fee"), rs.getBigDecimal("free_delivery_threshold"),
        textList(rs.getArray("announcement_messages"))));
  }

  @Transactional
  public StoreProfile updateProfile(UUID adminId, StoreProfileRequest request) {
    requireAdmin(adminId);
    List<String> cities = normalizeCities(request.operatingCities());
    String address = request.warehouseAddressLine().strip();
    String city = request.warehouseCity().strip();
    String warehousePhone = request.warehousePhone() == null ? "" : request.warehousePhone().strip();
    String whatsapp = normalizePhone(request.whatsappNumber(), "WhatsApp number");
    String bank = request.bankName().strip();
    String title = request.bankAccountTitle().strip();
    String account = request.bankAccountNumber().strip();
    String iban = request.bankIban() == null ? "" : request.bankIban().strip();
    BigDecimal deliveryFee = request.deliveryFee() == null ? BigDecimal.ZERO : request.deliveryFee();
    BigDecimal freeDeliveryThreshold = request.freeDeliveryThreshold() == null ? BigDecimal.ZERO : request.freeDeliveryThreshold();
    List<String> announcements = normalizeAnnouncements(request.announcementMessages());
    if (address.length() < 5 || city.isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the warehouse street address and city.");
    if (bank.isBlank() || title.isBlank() || account.isBlank())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the bank name, account title, and account number.");
    String returnAddress = formatWarehouse(address, city, warehousePhone, "");
    jdbc.update(connection -> {
      var statement = connection.prepareStatement("""
          INSERT INTO public.store_settings (
              id, operating_cities, warehouse_return_address, warehouse_address_line,
              warehouse_city, warehouse_phone, whatsapp_number, bank_name,
              bank_account_title, bank_account_number, bank_iban, delivery_fee,
              free_delivery_threshold, announcement_messages, updated_by, updated_at)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
              operating_cities=EXCLUDED.operating_cities,
              warehouse_return_address=EXCLUDED.warehouse_return_address,
              warehouse_address_line=EXCLUDED.warehouse_address_line,
              warehouse_city=EXCLUDED.warehouse_city,
              warehouse_phone=EXCLUDED.warehouse_phone,
              whatsapp_number=EXCLUDED.whatsapp_number,
              bank_name=EXCLUDED.bank_name,
              bank_account_title=EXCLUDED.bank_account_title,
              bank_account_number=EXCLUDED.bank_account_number,
              bank_iban=EXCLUDED.bank_iban,
              delivery_fee=EXCLUDED.delivery_fee,
              free_delivery_threshold=EXCLUDED.free_delivery_threshold,
              announcement_messages=EXCLUDED.announcement_messages,
              updated_by=EXCLUDED.updated_by, updated_at=CURRENT_TIMESTAMP
          """);
      Array cityArray = connection.createArrayOf("text", cities.toArray());
      statement.setArray(1, cityArray);
      statement.setString(2, returnAddress);
      statement.setString(3, address);
      statement.setString(4, city);
      statement.setString(5, warehousePhone);
      statement.setString(6, whatsapp);
      statement.setString(7, bank);
      statement.setString(8, title);
      statement.setString(9, account);
      statement.setString(10, iban);
      statement.setBigDecimal(11, deliveryFee);
      statement.setBigDecimal(12, freeDeliveryThreshold);
      statement.setArray(13, connection.createArrayOf("text", announcements.toArray()));
      statement.setObject(14, adminId);
      return statement;
    });
    return getProfile(adminId);
  }

  public boolean isOperatingCity(String city) {
    if (city == null || city.isBlank()) return false;
    return jdbc.queryForObject("""
        SELECT EXISTS (SELECT 1 FROM public.store_settings
          WHERE id=1 AND EXISTS (
            SELECT 1 FROM unnest(operating_cities) AS configured(city)
            WHERE lower(trim(configured.city))=lower(trim(?))))
        """, Boolean.class, city);
  }

  private static List<String> normalizeCities(List<String> input) {
    if (input == null || input.isEmpty())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one operating city.");
    LinkedHashSet<String> unique = new LinkedHashSet<>();
    for (String city : input) {
      if (city == null || city.isBlank()) continue;
      String value = city.strip().replaceAll("\\s+", " ");
      if (value.length() > 100)
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "City names can be up to 100 characters.");
      if (unique.stream().anyMatch(old -> old.equalsIgnoreCase(value)))
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Remove duplicate operating cities.");
      unique.add(value);
    }
    if (unique.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one operating city.");
    return List.copyOf(unique);
  }

  private static List<String> normalizeAnnouncements(List<String> input) {
    if (input == null) return List.of();
    LinkedHashSet<String> values = new LinkedHashSet<>();
    for (String message : input) {
      if (message == null || message.isBlank()) continue;
      String value = message.strip().replaceAll("\\s+", " ");
      if (value.length() > 240)
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each announcement can be up to 240 characters.");
      values.add(value);
      if (values.size() > 20)
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can save up to 20 announcement messages.");
    }
    return List.copyOf(values);
  }

  private static String normalizePhone(String input, String label) {
    String value = input == null ? "" : input.strip();
    String digits = value.replaceAll("\\D", "");
    if (digits.length() < 7 || digits.length() > 15)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid " + label + " with country code.");
    return digits;
  }

  private static List<String> textList(Array value) throws java.sql.SQLException {
    if (value == null) return List.of();
    Object raw = value.getArray();
    return raw instanceof String[] strings ? Arrays.asList(strings) : List.of();
  }

  private static String formatWarehouse(String address, String city, String phone, String fallback) {
    if (address == null || address.isBlank()) return fallback == null ? "" : fallback;
    StringBuilder result = new StringBuilder(address.strip());
    if (city != null && !city.isBlank()) result.append(", ").append(city.strip());
    if (phone != null && !phone.isBlank()) result.append(" · Contact: ").append(phone.strip());
    return result.toString();
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

  public record StoreProfile(List<String> operatingCities, String warehouseAddressLine,
      String warehouseCity, String warehousePhone, String whatsappNumber, String bankName,
      String bankAccountTitle, String bankAccountNumber, String bankIban,
      BigDecimal deliveryFee, BigDecimal freeDeliveryThreshold, List<String> announcementMessages) {}

  public record PublicStoreSettings(List<String> operatingCities, String whatsappNumber,
      String bankName, String bankAccountTitle, String bankAccountNumber, String bankIban,
      BigDecimal deliveryFee, BigDecimal freeDeliveryThreshold, List<String> announcementMessages) {}

  public record StoreProfileRequest(
      @jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=100) List<@jakarta.validation.constraints.Size(max=100) String> operatingCities,
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String warehouseAddressLine,
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=100) String warehouseCity,
      @jakarta.validation.constraints.Size(max=32) String warehousePhone,
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=32) String whatsappNumber,
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=120) String bankName,
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=120) String bankAccountTitle,
      @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=80) String bankAccountNumber,
      @jakarta.validation.constraints.Size(max=80) String bankIban,
      @jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.Digits(integer=10, fraction=2) BigDecimal deliveryFee,
      @jakarta.validation.constraints.DecimalMin("0.00") @jakarta.validation.constraints.Digits(integer=10, fraction=2) BigDecimal freeDeliveryThreshold,
      @jakarta.validation.constraints.Size(max=20) List<@jakarta.validation.constraints.Size(max=240) String> announcementMessages) {}

  public record PublicSettingsCheck(String city) {}
}
