package com.shopmart.api.admin;

import java.math.BigDecimal;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class AdminProductServiceIntegrationTests {

  @Autowired
  private AdminProductService products;

  @Autowired
  private JdbcTemplate jdbc;

  private UUID admin;
  private UUID customer;
  private UUID category;

  @BeforeEach
  void setUp() {
    admin = createUser("ADMIN");
    customer = createUser("CUSTOMER");
    category = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.categories (id, name)
        VALUES (?, ?)
        """, category, "Product Test " + category);
  }

  @Test
  void administratorCanCreateAndEditProduct() {
    var created = products.create(
        admin, request("Test Product", 5, true, 0));

    assertEquals("Test Product", created.name());
    assertEquals(5, created.stock());
    assertTrue(created.active());

    var updated = products.update(
        admin,
        created.id(),
        request("Updated Product", 8, false, created.version()));

    assertEquals("Updated Product", updated.name());
    assertEquals(8, updated.stock());
    assertFalse(updated.active());
    assertEquals(created.version() + 1, updated.version());

    // Admin catalog must include inactive products.
    long total = products.list(admin, 0, 100).totalItems();

    Long databaseTotal = jdbc.queryForObject(
        "SELECT COUNT(*) FROM public.products", Long.class);

    assertEquals(databaseTotal.longValue(), total);
  }

  @Test
  void staleEditCannotOverwriteChangedStock() {
    var created = products.create(
        admin, request("Stock Test", 5, true, 0));

    // Simulate stock changing after the admin opened the form.
    jdbc.update("""
        UPDATE public.products
        SET stock = 3, version = version + 1
        WHERE id = ?
        """, created.id());

    var error = assertThrows(
        ResponseStatusException.class,
        () -> products.update(
            admin,
            created.id(),
            request("Old Edit", 5, true, created.version())));

    assertEquals(HttpStatus.CONFLICT, error.getStatusCode());

    Integer stock = jdbc.queryForObject("""
        SELECT stock FROM public.products WHERE id = ?
        """, Integer.class, created.id());

    assertEquals(3, stock.intValue());
  }

  @Test
  void customerCannotCreateOrEditProducts() {
    var created = products.create(
        admin, request("Protected Product", 5, true, 0));

    assertForbidden(() -> products.list(customer, 0, 20));

    assertForbidden(() -> products.create(
        customer, request("Forbidden Product", 5, true, 0)));

    assertForbidden(() -> products.update(
        customer,
        created.id(),
        request("Forbidden Edit", 2, false, created.version())));
  }

  private AdminProductService.ProductRequest request(
      String name, int stock, boolean active, long version) {
    return new AdminProductService.ProductRequest(
        name,
        category,
        new BigDecimal("1500.00"),
        stock,
        active,
        version);
  }

  private UUID createUser(String role) {
    UUID id = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.users (
            id, name, email, password_hash, role
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        id,
        "Product Test User",
        id + "@example.com",
        "unused-test-hash",
        role);

    return id;
  }

  private void assertForbidden(
      org.junit.jupiter.api.function.Executable action) {
    var error = assertThrows(ResponseStatusException.class, action);

    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
  }
}