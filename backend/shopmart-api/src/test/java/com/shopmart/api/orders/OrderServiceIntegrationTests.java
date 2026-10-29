package com.shopmart.api.orders;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.ItemRequest;
import com.shopmart.api.orders.OrderModels.OrderPage;
import com.shopmart.api.orders.OrderModels.OrderReceipt;

import static com.shopmart.api.orders.OrderModels.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class OrderServiceIntegrationTests {

  @Autowired
  private OrderService orders;

  @Autowired
  private JdbcTemplate jdbc;

  private UUID customerId;
  private UUID productId;
  private UUID requestKey;

  @BeforeEach
  void prepareData() {
    customerId = UUID.randomUUID();
    productId = UUID.randomUUID();
    requestKey = UUID.randomUUID();
    UUID categoryId = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.users (id, name, email, password_hash)
        VALUES (?, ?, ?, ?)
        """,
        customerId,
        "Order Test Customer",
        customerId + "@example.com",
        "unused-test-hash");

    jdbc.update("""
        INSERT INTO public.categories (id, name)
        VALUES (?, ?)
        """, categoryId, "Test " + categoryId);

    jdbc.update("""
        INSERT INTO public.products (
            id, category_id, name, price, stock
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        productId, categoryId, "Test Product",
        new java.math.BigDecimal("999.99"), 3);
  }

  @Test
  void repeatedRequestCreatesOneOrderAndDecreasesStockOnce() {
    OrderReceipt first = orders.create(customerId, request(2));
    OrderReceipt repeated = orders.create(customerId, request(2));

    assertEquals(first.id(), repeated.id());
    assertEquals("1999.98", first.total());
    assertTrue(first.orderNumber().matches("SM-[0-9]{8,}"));
    assertEquals("PENDING", first.status());
    assertEquals("UNPAID", first.paymentStatus());
    assertEquals(1, remainingStock());

    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM public.orders WHERE user_id = ?",
            Integer.class,
            customerId));

    assertEquals(
        1,
        jdbc.queryForObject(
            """
                SELECT COUNT(*) FROM public.order_status_history
                WHERE order_id = ?
                """,
            Integer.class,
            first.id()));
  }

  @Test
  void sameRequestKeyCannotBeUsedForDifferentQuantities() {
    orders.create(customerId, request(2));

    ResponseStatusException error = assertThrows(
        ResponseStatusException.class,
        () -> orders.create(customerId, request(1)));

    assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    assertEquals(1, remainingStock());
  }

  @Test
  void insufficientStockRejectsOrder() {
    ResponseStatusException error = assertThrows(
        ResponseStatusException.class,
        () -> orders.create(customerId, request(4)));

    assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    assertEquals(3, remainingStock());

    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM public.orders WHERE user_id = ?",
            Integer.class,
            customerId));
  }

  @Test
  void anotherCustomerCannotReadTheOrder() {
    OrderReceipt receipt = orders.create(customerId, request(1));

    ResponseStatusException error = assertThrows(
        ResponseStatusException.class,
        () -> orders.getOrder(UUID.randomUUID(), receipt.id()));

    assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
  }

  private CreateOrderRequest request(int quantity) {
    return new CreateOrderRequest(
        requestKey,
        "Order Test Customer",
        "order-test@example.com",
        "03000000000",
        "Test delivery address",
        "Lahore",
        "COD",
        List.of(new ItemRequest(productId, quantity)));
  }

  private int remainingStock() {
    return jdbc.queryForObject(
        "SELECT stock FROM public.products WHERE id = ?",
        Integer.class,
        productId);
  }

  @Test
  void historyContainsOnlyTheCustomersOrders() {
    OrderReceipt created = orders.create(customerId, request(1));
    OrderPage history = orders.getOrders(customerId, 0, 20);

    assertEquals(1L, history.totalItems());
    assertEquals(created.id(), history.items().get(0).id());
    assertEquals(
        "Test delivery address",
        history.items().get(0).delivery().address());

    UUID otherCustomer = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.users (id, name, email, password_hash)
        VALUES (?, ?, ?, ?)
        """,
        otherCustomer,
        "Other Test Customer",
        otherCustomer + "@example.com",
        "unused-test-hash");

    OrderPage otherHistory = orders.getOrders(otherCustomer, 0, 20);

    assertEquals(0L, otherHistory.totalItems());
    assertTrue(otherHistory.items().isEmpty());
  }
}
