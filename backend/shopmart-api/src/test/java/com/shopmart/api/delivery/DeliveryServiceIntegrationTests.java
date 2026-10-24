package com.shopmart.api.delivery;

import java.util.List;
import java.util.UUID;

import com.shopmart.api.admin.AdminOrderService;
import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.ItemRequest;
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
class DeliveryServiceIntegrationTests {

    @Autowired
    private DeliveryService deliveries;

    @Autowired
    private RiderDeliveryService riderDeliveries;

    @Autowired
    private OrderService orders;

    @Autowired
    private AdminOrderService adminOrders;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID admin;
    private UUID customer;
    private UUID rider;
    private UUID order;

    @BeforeEach
    void setUp() {
        admin = createUser("ADMIN");
        customer = createUser("CUSTOMER");
        rider = createUser("RIDER");

        UUID category = UUID.randomUUID();
        UUID product = UUID.randomUUID();

        jdbc.update("""
                INSERT INTO public.categories (id, name)
                VALUES (?, ?)
                """, category, "Delivery Test " + category);

        jdbc.update("""
                INSERT INTO public.products (
                    id, category_id, name, price, currency,
                    stock, active, illustration, color
                )
                VALUES (?, ?, 'Delivery Test Product', 1000,
                        'PKR', 5, TRUE, 'headphones', 'lavender')
                """, product, category);

        order = orders.create(customer, new CreateOrderRequest(
                UUID.randomUUID(),
                "Delivery Test Customer",
                customer + "@example.com",
                "03000000000",
                "123 Test Street",
                "Lahore",
                "COD",
                List.of(new ItemRequest(product, 1)))).id();
    }

    @Test
    void confirmedOrderCanBeAssignedAndReassigned() {
        confirmOrder();

        deliveries.assign(admin, order, rider);
        deliveries.assign(admin, order, rider);

        assertEquals(rider, assignedRider());
        assertEquals(1L, assignmentCount());

        UUID replacement = createUser("RIDER");
        deliveries.assign(admin, order, replacement);

        assertEquals(replacement, assignedRider());
        assertEquals(1L, assignmentCount());
        assertEquals("CONFIRMED", orders.getOrder(customer, order).status());
    }

    @Test
    void pendingOrderCannotBeAssignedAndDispatchedOrderCannotBeReassigned() {
        assertStatus(HttpStatus.CONFLICT,
                () -> deliveries.assign(admin, order, rider));

        prepareDispatchedOrder();

        UUID replacement = createUser("RIDER");

        assertStatus(HttpStatus.CONFLICT,
                () -> deliveries.assign(admin, order, replacement));

        assertEquals(rider, assignedRider());
    }

    @Test
    void existingUnassignedDispatchedOrderCanBeRepaired() {
        long before = deliveries.list(admin, 0, 20).totalItems();

        // Fixture representing an order dispatched by the previous workflow.
        jdbc.update("""
                UPDATE public.orders
                SET status = 'DISPATCHED',
                    version = version + 1
                WHERE id = ?
                """, order);

        assertEquals(
                before + 1,
                deliveries.list(admin, 0, 20).totalItems());

        deliveries.assign(admin, order, rider);

        assertEquals(rider, assignedRider());
        assertEquals(1L, assignmentCount());
        assertEquals("DISPATCHED", orders.getOrder(customer, order).status());

        UUID replacement = createUser("RIDER");

        assertStatus(HttpStatus.CONFLICT,
                () -> deliveries.assign(admin, order, replacement));
    }

    @Test
    void customerAndDisabledRiderCannotBeAssigned() {
        confirmOrder();

        assertStatus(HttpStatus.BAD_REQUEST,
                () -> deliveries.assign(admin, order, customer));

        jdbc.update("""
                UPDATE public.users SET enabled = FALSE WHERE id = ?
                """, rider);

        assertStatus(HttpStatus.BAD_REQUEST,
                () -> deliveries.assign(admin, order, rider));

        assertEquals(0L, assignmentCount());
    }

    @Test
    void customerCannotAccessAdminDeliveryActions() {
        assertStatus(HttpStatus.FORBIDDEN,
                () -> deliveries.list(customer, 0, 20));

        assertStatus(HttpStatus.FORBIDDEN,
                () -> deliveries.riders(customer));

        assertStatus(HttpStatus.FORBIDDEN,
                () -> deliveries.assign(customer, order, rider));
    }

    @Test
    void riderSeesOnlyTheirOwnAssignments() {
        confirmOrder();
        deliveries.assign(admin, order, rider);

        UUID otherRider = createUser("RIDER");

        var assigned = riderDeliveries.list(rider, 0, 20);
        var unassigned = riderDeliveries.list(otherRider, 0, 20);

        assertEquals(1L, assigned.totalItems());
        assertEquals(order, assigned.items().get(0).id());
        assertEquals(0L, unassigned.totalItems());
    }

    @Test
    void riderCanCompleteDispatchedOrderOnlyOnce() {
        prepareDispatchedOrder();

        riderDeliveries.complete(rider, order);
        riderDeliveries.complete(rider, order);

        var receipt = orders.getOrder(customer, order);

        assertEquals("DELIVERED", receipt.status());
        assertEquals("PAID", receipt.paymentStatus());

        Long deliveredEvents = jdbc.queryForObject("""
                SELECT COUNT(*)
                FROM public.order_status_history
                WHERE order_id = ? AND status = 'DELIVERED'
                """, Long.class, order);

        UUID changedBy = jdbc.queryForObject("""
                SELECT changed_by
                FROM public.order_status_history
                WHERE order_id = ? AND status = 'DELIVERED'
                """, UUID.class, order);

        assertEquals(1L, deliveredEvents.longValue());
        assertEquals(rider, changedBy);
    }

    @Test
    void wrongRiderCustomerAndAdminCannotCompleteDelivery() {
        prepareDispatchedOrder();

        UUID otherRider = createUser("RIDER");

        assertStatus(HttpStatus.NOT_FOUND,
                () -> riderDeliveries.complete(otherRider, order));

        assertStatus(HttpStatus.FORBIDDEN,
                () -> riderDeliveries.complete(customer, order));

        assertStatus(HttpStatus.FORBIDDEN,
                () -> riderDeliveries.complete(admin, order));

        assertStatus(HttpStatus.FORBIDDEN,
                () -> riderDeliveries.list(customer, 0, 20));

        assertEquals("DISPATCHED", orders.getOrder(customer, order).status());
        assertEquals("UNPAID", orders.getOrder(customer, order).paymentStatus());
    }

    @Test
    void disabledRiderCannotCompleteDelivery() {
        prepareDispatchedOrder();

        jdbc.update("""
                UPDATE public.users SET enabled = FALSE WHERE id = ?
                """, rider);

        assertStatus(HttpStatus.FORBIDDEN,
                () -> riderDeliveries.complete(rider, order));

        assertEquals("DISPATCHED", orders.getOrder(customer, order).status());
        assertEquals("UNPAID", orders.getOrder(customer, order).paymentStatus());
    }

    @Test
    void riderCannotCompleteBeforeDispatchOrAfterCancellation() {
        confirmOrder();
        deliveries.assign(admin, order, rider);

        assertStatus(HttpStatus.CONFLICT,
                () -> riderDeliveries.complete(rider, order));

        adminOrders.updateStatus(
                admin,
                order,
                new AdminOrderService.StatusRequest("CANCELLED"));

        assertStatus(HttpStatus.CONFLICT,
                () -> riderDeliveries.complete(rider, order));

        assertEquals("CANCELLED", orders.getOrder(customer, order).status());
    }

    private void confirmOrder() {
        adminOrders.updateStatus(
                admin,
                order,
                new AdminOrderService.StatusRequest("CONFIRMED"));
    }

    private void prepareDispatchedOrder() {
        confirmOrder();
        deliveries.assign(admin, order, rider);

        adminOrders.updateStatus(
                admin,
                order,
                new AdminOrderService.StatusRequest("DISPATCHED"));
    }

    private UUID assignedRider() {
        return jdbc.queryForObject("""
                SELECT rider_id
                FROM public.delivery_assignments
                WHERE order_id = ?
                """, UUID.class, order);
    }

    private long assignmentCount() {
        return jdbc.queryForObject("""
                SELECT COUNT(*)
                FROM public.delivery_assignments
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
                "Delivery Test User",
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