package com.shopmart.api.admin;

import java.util.List;
import java.util.UUID;

import com.shopmart.api.delivery.DeliveryService;
import com.shopmart.api.delivery.RiderDeliveryService;
import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.ItemRequest;
import com.shopmart.api.orders.OrderModels.OrderReceipt;
import com.shopmart.api.orders.OrderService;

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
class AdminOrderStatusIntegrationTests {

  @Autowired
  private AdminOrderService adminOrders;

  @Autowired
  private OrderService orders;

  @Autowired
  private DeliveryService deliveries;

  @Autowired
  private RiderDeliveryService riderDeliveries;

  @Autowired
  private JdbcTemplate jdbc;

  private UUID admin;
  private UUID customer;
  private UUID rider;
  private UUID product;
  private UUID order;

  @BeforeEach
  void setUp() {
    admin = createUser("ADMIN");
    customer = createUser("CUSTOMER");
    rider = createUser("RIDER");

    UUID category = UUID.randomUUID();
    product = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.categories (id, name)
        VALUES (?, ?)
        """, category, "Status Test " + category);

    jdbc.update("""
        INSERT INTO public.products (
            id, category_id, name, price, currency,
            stock, active, illustration, color
        )
        VALUES (?, ?, 'Status Test Product', 1000,
                'PKR', 5, TRUE, 'headphones', 'lavender')
        """, product, category);

    order = orders.create(customer, new CreateOrderRequest(
        UUID.randomUUID(),
        "Test Customer",
        customer + "@example.com",
        "03000000000",
        "123 Test Street",
        "Lahore",
        "COD",
        List.of(new ItemRequest(product, 2)))).id();
  }

  @Test
  void assignedRiderCompletesDeliveryAndRecordsPayment() {
    change("CONFIRMED");
    deliveries.assign(admin, order, rider);
    change("DISPATCHED");

    assertEquals("UNPAID", orders.getOrder(customer, order).paymentStatus());

    riderDeliveries.complete(rider, order);

    var delivered = orders.getOrder(customer, order);

    assertEquals("DELIVERED", delivered.status());
    assertEquals("PAID", delivered.paymentStatus());
    assertEquals(3, stock());
    assertEquals(4L, historyCount());

    UUID completedBy = jdbc.queryForObject("""
        SELECT changed_by
        FROM public.order_status_history
        WHERE order_id = ? AND status = 'DELIVERED'
        """, UUID.class, order);

    assertEquals(rider, completedBy);
  }

  @Test
  void dispatchRequiresAssignedEnabledRider() {
    change("CONFIRMED");

    assertStatus(HttpStatus.CONFLICT, () -> change("DISPATCHED"));

    assertEquals("CONFIRMED", orders.getOrder(customer, order).status());
    assertEquals(2L, historyCount());

    deliveries.assign(admin, order, rider);

    jdbc.update("""
        UPDATE public.users SET enabled = FALSE WHERE id = ?
        """, rider);

    assertStatus(HttpStatus.CONFLICT, () -> change("DISPATCHED"));

    assertEquals("CONFIRMED", orders.getOrder(customer, order).status());
    assertEquals("UNPAID", orders.getOrder(customer, order).paymentStatus());
    assertEquals(3, stock());
    assertEquals(2L, historyCount());
  }

  @Test
  void administratorCannotConfirmDelivery() {
    change("CONFIRMED");
    deliveries.assign(admin, order, rider);
    change("DISPATCHED");

    assertStatus(HttpStatus.FORBIDDEN, () -> change("DELIVERED"));

    assertEquals("DISPATCHED", orders.getOrder(customer, order).status());
    assertEquals("UNPAID", orders.getOrder(customer, order).paymentStatus());
    assertEquals(3L, historyCount());
  }

  @Test
  void cancellationRestoresStockOnlyOnce() {
    change("CONFIRMED");

    var cancelled = change("CANCELLED");
    change("CANCELLED");

    assertEquals("CANCELLED", cancelled.status());
    assertEquals("UNPAID", cancelled.paymentStatus());
    assertEquals(5, stock());
    assertEquals(3L, historyCount());
  }

  @Test
  void invalidTransitionsDoNotChangeStockOrHistory() {
    assertStatus(HttpStatus.CONFLICT, () -> change("DISPATCHED"));

    assertEquals("PENDING", orders.getOrder(customer, order).status());
    assertEquals(3, stock());
    assertEquals(1L, historyCount());

    change("CONFIRMED");
    deliveries.assign(admin, order, rider);
    change("DISPATCHED");

    assertStatus(HttpStatus.CONFLICT, () -> change("CANCELLED"));

    assertEquals("DISPATCHED", orders.getOrder(customer, order).status());
    assertEquals(3, stock());
    assertEquals(3L, historyCount());
  }

  @Test
  void customerCannotChangeOrderStatus() {
    assertStatus(HttpStatus.FORBIDDEN,
        () -> adminOrders.updateStatus(
            customer,
            order,
            new AdminOrderService.StatusRequest("CONFIRMED")));

    assertEquals("PENDING", orders.getOrder(customer, order).status());
    assertEquals(1L, historyCount());
  }

  private OrderReceipt change(String status) {
    return adminOrders.updateStatus(
        admin, order, new AdminOrderService.StatusRequest(status));
  }

  private int stock() {
    return jdbc.queryForObject("""
        SELECT stock FROM public.products WHERE id = ?
        """, Integer.class, product);
  }

  private long historyCount() {
    return jdbc.queryForObject("""
        SELECT COUNT(*)
        FROM public.order_status_history
        WHERE order_id = ?
        """, Long.class, order);
  }

  private UUID createUser(String role) {
    UUID id = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.users (
            id, name, email, password_hash, role
        )
        VALUES (?, ?, ?, 'unused-test-hash', ?)
        """,
        id,
        "Status Test User",
        id + "@example.com",
        role);

    return id;
  }

  private void assertStatus(
      HttpStatus expected,
      org.junit.jupiter.api.function.Executable action) {
    var error = assertThrows(ResponseStatusException.class, action);
    assertEquals(expected, error.getStatusCode());
  }
}