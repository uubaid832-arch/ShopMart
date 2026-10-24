package com.shopmart.api.delivery;

import java.util.List;
import java.util.UUID;

import com.shopmart.api.admin.AdminOrderService;
import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.ItemRequest;
import com.shopmart.api.orders.OrderService;
import com.shopmart.api.notifications.NotificationService;
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
class WarehouseServiceIntegrationTests {
  @Autowired WarehouseService warehouse;
  @Autowired RiderDeliveryService riderDeliveries;
  @Autowired DeliveryService deliveries;
  @Autowired AdminOrderService adminOrders;
  @Autowired OrderService orders;
  @Autowired JdbcTemplate jdbc;
  @Autowired NotificationService notifications;

  private UUID admin;
  private UUID customer;
  private UUID rider;
  private UUID product;
  private UUID order;
  private UUID attempt;

  @BeforeEach
  void setUp() {
    admin = user("ADMIN");
    customer = user("CUSTOMER");
    rider = user("RIDER");
    UUID category = UUID.randomUUID();
    product = UUID.randomUUID();
    jdbc.update("INSERT INTO public.categories (id, name) VALUES (?, ?)", category, "Warehouse Test " + category);
    jdbc.update("""
        INSERT INTO public.products (id, category_id, name, price, currency,
            stock, active, illustration, color)
        VALUES (?, ?, 'Warehouse Test Product', 1000, 'PKR', 5, TRUE, 'headphones', 'lavender')
        """, product, category);
    order = orders.create(customer, new CreateOrderRequest(UUID.randomUUID(),
        "Warehouse Test Customer", customer + "@example.com", "03000000000",
        "123 Test Street", "Lahore", "COD", List.of(new ItemRequest(product, 2)))).id();
    adminOrders.updateStatus(admin, order, new AdminOrderService.StatusRequest("CONFIRMED"));
    deliveries.assign(admin, order, rider);
    dispatch();
    attempt = UUID.randomUUID();
    riderDeliveries.reportFailure(rider, order, new RiderDeliveryService.FailureRequest(
        attempt, "CUSTOMER_UNAVAILABLE", "No one was available."));
  }

  @Test
  void warehouseReturnBlocksCompletionAndRequiresReceipt() {
    var request = new WarehouseService.AttemptRequest(attempt);
    status(HttpStatus.CONFLICT, () -> warehouse.confirmReceipt(admin, order, request));
    warehouse.reportReturn(rider, order, request);
    warehouse.reportReturn(rider, order, request);
    assertNotNull(warehouse.get(admin, order).reportedAt());
    status(HttpStatus.CONFLICT, () -> riderDeliveries.complete(rider, order));
    status(HttpStatus.CONFLICT, () -> riderDeliveries.reportFailure(rider, order,
        new RiderDeliveryService.FailureRequest(UUID.randomUUID(), "UNREACHABLE", "")));
    status(HttpStatus.CONFLICT, () -> warehouse.resolve(admin, order,
        new WarehouseService.ResolutionRequest(attempt, "CANCEL", null)));
    assertEquals("UNPAID", orders.getOrder(customer, order).paymentStatus());
    assertEquals(3, stock());
  }

  @Test
  void cancellationRestoresStockOnceAfterReceipt() {
    receive();
    var resolution = new WarehouseService.ResolutionRequest(attempt, "CANCEL", null);
    warehouse.resolve(admin, order, resolution);
    warehouse.resolve(admin, order, resolution);
    assertEquals("CANCELLED", orders.getOrder(customer, order).status());
    assertEquals("UNPAID", orders.getOrder(customer, order).paymentStatus());
    assertEquals(5, stock());
    assertEquals("CANCEL", warehouse.get(admin, order).resolution());
    status(HttpStatus.CONFLICT, () -> warehouse.resolve(admin, order,
        new WarehouseService.ResolutionRequest(attempt, "RETRY", rider)));
  }

  @Test
  void retryRequiresNewDispatchAndNotifiesAgain() {
    receive();
    UUID replacement = user("RIDER");
    var request = new WarehouseService.ResolutionRequest(attempt, "RETRY", replacement);
    warehouse.resolve(admin, order, request);
    warehouse.resolve(admin, order, request);
    assertEquals("CONFIRMED", orders.getOrder(customer, order).status());
    assertEquals(3, stock());
    status(HttpStatus.NOT_FOUND, () -> riderDeliveries.complete(rider, order));
    status(HttpStatus.CONFLICT, () -> riderDeliveries.complete(replacement, order));
    dispatch();
    // Repeat the notification call for the same event: no duplicate.
    notifications.orderStatusChanged(order, "DISPATCHED");
    long dispatchedNotices = jdbc.queryForObject("""
        SELECT COUNT(*) FROM public.notifications
        WHERE user_id = ? AND order_id = ?
          AND event_key LIKE 'CUSTOMER_ORDER_STATUS:%'
          AND message LIKE '%has been dispatched.%'
        """, Long.class, customer, order);
    assertEquals(2L, dispatchedNotices);
    riderDeliveries.complete(replacement, order);
    assertEquals("DELIVERED", orders.getOrder(customer, order).status());
    assertEquals("PAID", orders.getOrder(customer, order).paymentStatus());
    assertEquals(3, stock());
  }

  @Test
  void customerAndUnassignedRiderCannotResolveOrReturn() {
    var request = new WarehouseService.AttemptRequest(attempt);
    UUID stranger = user("RIDER");
    status(HttpStatus.FORBIDDEN, () -> warehouse.get(customer, order));
    status(HttpStatus.NOT_FOUND, () -> warehouse.get(stranger, order));
    status(HttpStatus.NOT_FOUND, () -> warehouse.reportReturn(stranger, order, request));
    status(HttpStatus.FORBIDDEN, () -> warehouse.confirmReceipt(rider, order, request));
    status(HttpStatus.FORBIDDEN, () -> warehouse.resolve(customer, order,
        new WarehouseService.ResolutionRequest(attempt, "CANCEL", null)));
    assertEquals(3, stock());
  }

  private void receive() {
    var request = new WarehouseService.AttemptRequest(attempt);
    warehouse.reportReturn(rider, order, request);
    warehouse.confirmReceipt(admin, order, request);
    warehouse.confirmReceipt(admin, order, request);
  }

  private void dispatch() {
    adminOrders.updateStatus(admin, order, new AdminOrderService.StatusRequest("DISPATCHED"));
  }

  private int stock() {
    return jdbc.queryForObject("SELECT stock FROM public.products WHERE id = ?", Integer.class, product);
  }

  private UUID user(String role) {
    UUID id = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO public.users (id, name, email, password_hash, role)
        VALUES (?, 'Warehouse Test User', ?, 'unused-test-hash', ?)
        """, id, id + "@example.com", role);
    return id;
  }

  private void status(HttpStatus expected, org.junit.jupiter.api.function.Executable action) {
    var error = assertThrows(ResponseStatusException.class, action);
    assertEquals(expected, error.getStatusCode());
  }
}
