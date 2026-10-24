package com.shopmart.api.addresses;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static com.shopmart.api.addresses.AddressModels.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class AddressServiceIntegrationTests {

  @Autowired
  private AddressService addresses;

  @Autowired
  private JdbcTemplate jdbc;

  private UUID customer;
  private UUID otherCustomer;

  @BeforeEach
  void setUp() {
    customer = createCustomer();
    otherCustomer = createCustomer();
  }

  @Test
  void firstAddressIsDefaultAndCanBeUpdated() {
    AddressResponse saved = addresses.create(
        customer, request("Home", false));

    assertTrue(saved.isDefault());
    assertEquals("Home", saved.label());
    assertEquals(1, addresses.list(customer).size());

    AddressResponse updated = addresses.update(
        customer, saved.id(), request("Office", true));

    assertEquals(saved.id(), updated.id());
    assertEquals("Office", updated.label());
    assertTrue(updated.isDefault());
  }

  @Test
  void selectingAnotherDefaultClearsThePreviousDefault() {
    AddressResponse first = addresses.create(
        customer, request("Home", false));

    AddressResponse second = addresses.create(
        customer, request("Office", false));

    assertFalse(second.isDefault());

    addresses.update(customer, second.id(), request("Office", true));

    var results = addresses.list(customer);

    assertEquals(
        1L,
        results.stream().filter(AddressResponse::isDefault).count());

    assertTrue(results.stream()
        .anyMatch(address -> address.id().equals(second.id()) && address.isDefault()));

    assertTrue(results.stream()
        .anyMatch(address -> address.id().equals(first.id()) && !address.isDefault()));
  }

  @Test
  void customersCannotReadChangeOrDeleteAnotherCustomersAddress() {
    AddressResponse saved = addresses.create(
        customer, request("Home", true));

    AddressResponse otherDefault = addresses.create(
        otherCustomer, request("Other home", true));

    var visible = addresses.list(otherCustomer);

    assertEquals(1, visible.size());
    assertEquals(otherDefault.id(), visible.get(0).id());

    ResponseStatusException updateError = assertThrows(
        ResponseStatusException.class,
        () -> addresses.update(
            otherCustomer, saved.id(), request("Changed", true)));

    assertEquals(HttpStatus.NOT_FOUND, updateError.getStatusCode());

    ResponseStatusException deleteError = assertThrows(
        ResponseStatusException.class,
        () -> addresses.delete(otherCustomer, saved.id()));

    assertEquals(HttpStatus.NOT_FOUND, deleteError.getStatusCode());

    assertEquals("Home", addresses.list(customer).get(0).label());
    assertTrue(addresses.list(otherCustomer).get(0).isDefault());
  }

  @Test
  void customerCanDeleteTheirOwnAddress() {
    AddressResponse saved = addresses.create(
        customer, request("Home", true));

    addresses.delete(customer, saved.id());

    assertTrue(addresses.list(customer).isEmpty());
  }

  private UUID createCustomer() {
    UUID id = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.users (id, name, email, password_hash)
        VALUES (?, ?, ?, ?)
        """,
        id,
        "Address Test Customer",
        id + "@example.com",
        "unused-test-hash");

    return id;
  }

  private AddressRequest request(String label, boolean isDefault) {
    return new AddressRequest(
        label,
        "Test Customer",
        "03000000000",
        "123 Test Street",
        "Lahore",
        "54000",
        "Pakistan",
        isDefault);
  }
}