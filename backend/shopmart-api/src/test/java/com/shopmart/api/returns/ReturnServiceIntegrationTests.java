package com.shopmart.api.returns;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.shopmart.api.admin.AdminOrderService;
import com.shopmart.api.delivery.DeliveryService;
import com.shopmart.api.delivery.RiderDeliveryService;
import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.ItemRequest;
import com.shopmart.api.orders.OrderService;
import com.shopmart.api.cod.RiderCodService;

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
class ReturnServiceIntegrationTests {

    @Autowired
    private AdminReturnService adminReturns;

    @Autowired
    private AdminRefundService refunds;

    @Autowired
    private ReturnService returns;

    @Autowired
    private OrderService orders;

    @Autowired
    private AdminOrderService adminOrders;

    @Autowired
    private DeliveryService deliveries;

    @Autowired
    private RiderDeliveryService riderDeliveries;

    @Autowired
    private RiderCodService riderCod;

    @Autowired
    private JdbcTemplate jdbc;

    private UUID admin;
    private UUID customer;
    private UUID otherCustomer;
    private UUID rider;
    private UUID product;
    private UUID order;
    private UUID orderItem;

    @BeforeEach
    void setUp() {
        admin = createUser("ADMIN");
        customer = createUser("CUSTOMER");
        otherCustomer = createUser("CUSTOMER");
        rider = createUser("RIDER");

        UUID category = UUID.randomUUID();
        product = UUID.randomUUID();

        jdbc.update("""
                INSERT INTO public.categories (id, name)
                VALUES (?, ?)
                """, category, "Return Test " + category);

        jdbc.update("""
                INSERT INTO public.products (
                    id, category_id, name, price, currency,
                    stock, active, illustration, color
                )
                VALUES (?, ?, 'Return Test Product', 1000,
                        'PKR', 5, TRUE, 'headphones', 'lavender')
                """, product, category);

        order = orders.create(customer, new CreateOrderRequest(
                UUID.randomUUID(),
                "Return Test Customer",
                customer + "@example.com",
                "03000000000",
                "123 Test Street",
                "Lahore",
                "COD",
                List.of(new ItemRequest(product, 2)))).id();

        orderItem = jdbc.queryForObject("""
                SELECT id FROM public.order_items WHERE order_id = ?
                """, UUID.class, order);
    }

    @Test
    void deliveredPaidItemCanBeRequestedOnlyOnce() {
        deliverOrder();

        var eligible = returns.eligible(customer, 0, 20);

        assertEquals(1L, eligible.totalItems());
        assertEquals(orderItem, eligible.items().get(0).orderItemId());

        UUID requestId = returns.create(customer, request());

        var history = returns.list(customer, 0, 20);
        var saved = history.items().get(0);

        assertEquals(1L, history.totalItems());
        assertEquals(requestId, saved.id());
        assertEquals("PENDING", saved.status());
        assertEquals("NOT_INITIATED", saved.refundStatus());
        assertEquals(
                0,
                new BigDecimal("2000.00")
                        .compareTo(new BigDecimal(saved.refundAmount())));

        assertEquals(0L, returns.eligible(customer, 0, 20).totalItems());

        assertStatus(HttpStatus.CONFLICT,
                () -> returns.create(customer, request()));

        assertEquals("PAID", orders.getOrder(customer, order).paymentStatus());
        assertEquals(3, stock());
    }

    @Test
    void undeliveredOrUnpaidOrdersAreNotEligible() {
        assertEquals(0L, returns.eligible(customer, 0, 20).totalItems());

        assertStatus(HttpStatus.CONFLICT,
                () -> returns.create(customer, request()));

        deliverOrder();

        // Fixture for checking the payment eligibility rule independently.
        jdbc.update("""
                UPDATE public.orders
                SET payment_status = 'UNPAID'
                WHERE id = ?
                """, order);

        assertEquals(0L, returns.eligible(customer, 0, 20).totalItems());

        assertStatus(HttpStatus.CONFLICT,
                () -> returns.create(customer, request()));
    }

    @Test
    void customerCannotAccessAnotherCustomersReturn() {
        deliverOrder();

        assertEquals(
                0L, returns.eligible(otherCustomer, 0, 20).totalItems());

        assertStatus(HttpStatus.NOT_FOUND,
                () -> returns.create(otherCustomer, request()));

        returns.create(customer, request());

        assertEquals(0L, returns.list(otherCustomer, 0, 20).totalItems());
        assertEquals(1L, returns.list(customer, 0, 20).totalItems());
    }

    @Test
    void receivedReturnCanBeRefundedOnlyOnce() {
        deliverOrder();
        UUID requestId = returns.create(customer, request());

        receiveReturn(requestId);
        confirmCodHandover();

        assertEquals("RETURNED", orders.getOrder(customer, order).status());
        assertEquals("PAID", orders.getOrder(customer, order).paymentStatus());

        var refund = new AdminRefundService.RefundRequest(
                "TEST-RECEIPT-" + requestId);

        refunds.record(admin, requestId, refund);
        refunds.record(admin, requestId, refund);

        var saved = returns.list(customer, 0, 20).items().get(0);

        assertEquals("REFUNDED", saved.refundStatus());
        assertEquals("REFUNDED", orders.getOrder(customer, order).paymentStatus());

        assertStatus(HttpStatus.CONFLICT,
                () -> refunds.record(
                        admin,
                        requestId,
                        new AdminRefundService.RefundRequest("DIFFERENT-RECEIPT")));

        String reference = jdbc.queryForObject("""
                SELECT refund_reference
                FROM public.return_requests
                WHERE id = ?
                """, String.class, requestId);

        assertEquals(refund.reference(), reference);
        assertEquals(3, stock());
    }

    @Test
    void codRefundIsBlockedWhileCashIsStillHeldByRider() {
        deliverOrder();
        UUID requestId = returns.create(customer, request());
        receiveReturn(requestId);

        assertStatus(HttpStatus.CONFLICT,
                () -> refunds.record(admin, requestId,
                        new AdminRefundService.RefundRequest("TEST-RECEIPT")));

        assertEquals("NOT_INITIATED", jdbc.queryForObject(
                "SELECT refund_status FROM public.return_requests WHERE id = ?",
                String.class, requestId));
        assertEquals("PAID", orders.getOrder(customer, order).paymentStatus());
    }

    @Test
    void codRefundIsBlockedWhileHandoverAwaitsAdminReview() {
        deliverOrder();
        UUID requestId = returns.create(customer, request());
        receiveReturn(requestId);
        reportCodHandover();

        assertStatus(HttpStatus.CONFLICT,
                () -> refunds.record(admin, requestId,
                        new AdminRefundService.RefundRequest("TEST-RECEIPT")));

        assertEquals("NOT_INITIATED", jdbc.queryForObject(
                "SELECT refund_status FROM public.return_requests WHERE id = ?",
                String.class, requestId));
        assertEquals("PAID", orders.getOrder(customer, order).paymentStatus());
    }

    @Test
    void refundRequiresReceivedGoodsAndAdministratorAccess() {
        deliverOrder();
        UUID requestId = returns.create(customer, request());

        var refund = new AdminRefundService.RefundRequest(
                "TEST-RECEIPT-" + requestId);

        assertStatus(HttpStatus.CONFLICT,
                () -> refunds.record(admin, requestId, refund));

        assertStatus(HttpStatus.CONFLICT,
                () -> adminReturns.updateStatus(
                        admin,
                        requestId,
                        new AdminReturnService.StatusRequest("RECEIVED")));

        assertStatus(HttpStatus.FORBIDDEN,
                () -> adminReturns.updateStatus(
                        customer,
                        requestId,
                        new AdminReturnService.StatusRequest("APPROVED")));

        receiveReturn(requestId);

        assertStatus(HttpStatus.FORBIDDEN,
                () -> refunds.record(customer, requestId, refund));

        assertEquals(
                "NOT_INITIATED",
                returns.list(customer, 0, 20).items().get(0).refundStatus());
    }

    @Test
    void rejectedReturnCannotBeApprovedOrRefunded() {
        deliverOrder();
        UUID requestId = returns.create(customer, request());

        adminReturns.updateStatus(
                admin,
                requestId,
                new AdminReturnService.StatusRequest("REJECTED"));

        assertStatus(HttpStatus.CONFLICT,
                () -> adminReturns.updateStatus(
                        admin,
                        requestId,
                        new AdminReturnService.StatusRequest("APPROVED")));

        assertStatus(HttpStatus.CONFLICT,
                () -> refunds.record(
                        admin,
                        requestId,
                        new AdminRefundService.RefundRequest("TEST-RECEIPT")));

        assertEquals("DELIVERED", orders.getOrder(customer, order).status());
        assertEquals("PAID", orders.getOrder(customer, order).paymentStatus());
    }

    private ReturnService.CreateReturnRequest request() {
        return new ReturnService.CreateReturnRequest(
                order, orderItem, "Item arrived damaged.");
    }

    private void deliverOrder() {
        adminOrders.updateStatus(
                admin,
                order,
                new AdminOrderService.StatusRequest("CONFIRMED"));

        deliveries.assign(admin, order, rider);

        adminOrders.updateStatus(
                admin,
                order,
                new AdminOrderService.StatusRequest("DISPATCHED"));

        riderDeliveries.complete(rider, order);
    }

    private void receiveReturn(UUID requestId) {
        adminReturns.updateStatus(
                admin,
                requestId,
                new AdminReturnService.StatusRequest("APPROVED"));

        adminReturns.updateStatus(
                admin,
                requestId,
                new AdminReturnService.StatusRequest("RECEIVED"));
    }

    private UUID reportCodHandover() {
        UUID collectionId = jdbc.queryForObject("""
                SELECT id FROM public.rider_cod_collections WHERE order_id = ?
                """, UUID.class, order);
        UUID handoverId = UUID.randomUUID();
        riderCod.report(rider, new RiderCodService.ReportRequest(
                handoverId, List.of(collectionId), "Return test COD handover"));
        return handoverId;
    }

    private void confirmCodHandover() {
        UUID handoverId = reportCodHandover();
        riderCod.decide(admin, handoverId,
                new RiderCodService.DecisionRequest("CONFIRMED", "Cash counted"));
    }

    private int stock() {
        return jdbc.queryForObject("""
                SELECT stock FROM public.products WHERE id = ?
                """, Integer.class, product);
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
                "Return Test User",
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
