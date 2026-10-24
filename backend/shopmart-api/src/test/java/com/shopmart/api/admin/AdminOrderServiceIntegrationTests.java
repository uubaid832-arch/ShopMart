package com.shopmart.api.admin;

import java.util.UUID;

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
class AdminOrderServiceIntegrationTests {

  @Autowired
  private AdminOrderService orders;

  @Autowired
  private JdbcTemplate jdbc;

  @Test
  void administratorCanListOrders() {
    UUID admin = createUser("ADMIN", true);

    var result = orders.list(admin, 0, 20);

    assertEquals(0, result.page());
    assertEquals(20, result.size());
    assertTrue(result.totalItems() >= result.items().size());
  }

  @Test
  void customerCannotListOrReadAdminOrders() {
    UUID customer = createUser("CUSTOMER", true);

    assertForbidden(() -> orders.list(customer, 0, 20));
    assertForbidden(() -> orders.get(customer, UUID.randomUUID()));
  }

  @Test
  void disabledAdministratorCannotAccessOrders() {
    UUID admin = createUser("ADMIN", false);

    assertForbidden(() -> orders.list(admin, 0, 20));
    assertForbidden(() -> orders.get(admin, UUID.randomUUID()));
  }

  @Test
  void invalidPaginationIsRejected() {
    UUID admin = createUser("ADMIN", true);

    ResponseStatusException error = assertThrows(
        ResponseStatusException.class,
        () -> orders.list(admin, -1, 20));

    assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
  }

  private UUID createUser(String role, boolean enabled) {
    UUID id = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.users (
            id, name, email, password_hash, role, enabled
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        id,
        "Admin Order Test",
        id + "@example.com",
        "unused-test-hash",
        role,
        enabled);

    return id;
  }

  private void assertForbidden(
      org.junit.jupiter.api.function.Executable action) {
    ResponseStatusException error = assertThrows(
        ResponseStatusException.class, action);

    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
  }
}