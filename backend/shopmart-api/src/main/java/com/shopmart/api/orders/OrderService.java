package com.shopmart.api.orders;

import java.math.BigDecimal;
import com.shopmart.api.vouchers.VoucherService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.util.*;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;
import com.shopmart.api.notifications.NotificationService;
import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.DeliveryDetails;
import com.shopmart.api.orders.OrderModels.ItemRequest;
import com.shopmart.api.orders.OrderModels.OrderLine;
import com.shopmart.api.orders.OrderModels.OrderPage;
import com.shopmart.api.orders.OrderModels.OrderReceipt;

import static com.shopmart.api.orders.OrderModels.*;

@Service
@Validated
public class OrderService {

    private final JdbcTemplate jdbc;
    private final NotificationService notifications;
    private final VoucherService vouchers;

    public OrderService(
            JdbcTemplate jdbc,
            NotificationService notifications,
            VoucherService vouchers) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.vouchers = vouchers;
    }

    @Transactional
    public OrderReceipt create(
            UUID userId,
            @Valid CreateOrderRequest request) {
        return createInternal(userId, request, false);
    }

    @Transactional
    public OrderReceipt createSafepayVerified(UUID userId, @Valid CreateOrderRequest request) {
        if (!"DEMO".equals(request.paymentMethod())) throw failure(HttpStatus.BAD_REQUEST, "Sandbox orders must use demo accounting.");
        return createInternal(userId, request, true);
    }

    private OrderReceipt createInternal(UUID userId, CreateOrderRequest request, boolean verifiedSafepay) {
        // Serialize this customer's order requests.
        List<Boolean> accounts = jdbc.query(
                "SELECT enabled FROM public.users WHERE id = ? FOR UPDATE",
                (rs, row) -> rs.getBoolean("enabled"),
                userId);

        if (accounts.isEmpty() || !accounts.get(0)) {
            throw failure(
                    HttpStatus.UNAUTHORIZED,
                    "Please sign in again.");
        }

        String name = request.name().strip();
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        String phone = request.phone().strip();
        String address = request.address().strip();
        String city = request.city().strip();
        String paymentMethod = request.paymentMethod();

        if (!Set.of("COD", "DEMO").contains(paymentMethod)) {
            throw failure(
                    HttpStatus.BAD_REQUEST,
                    "Select a supported payment method.");
        }

        String paymentStatus = "DEMO".equals(paymentMethod)
                ? "DEMO_PAID"
                : "UNPAID";

        if (name.isBlank()
                || phone.isBlank()
                || address.isBlank()
                || city.isBlank()) {
            throw failure(
                    HttpStatus.BAD_REQUEST,
                    "Please complete the delivery details.");
        }

        // Lock products in a consistent order.
        SortedMap<UUID, Integer> quantities = new TreeMap<>();

        for (ItemRequest item : request.items()) {
            if (quantities.putIfAbsent(
                    item.productId(),
                    item.quantity()) != null) {
                throw failure(
                        HttpStatus.BAD_REQUEST,
                        "Each product must appear only once.");
            }
        }
        List<String> fingerprintParts = new ArrayList<>(
                List.of(name, email, phone, address, city, paymentMethod));

        String voucherCode = VoucherService.normalize(request.voucherCode());
        // Keep legacy request hashes unchanged for carts without a voucher.
        if (voucherCode != null) fingerprintParts.add("voucher:" + voucherCode);
        if (request.expectedTotal()!=null) fingerprintParts.add("expected:" + request.expectedTotal().stripTrailingZeros().toPlainString());
        quantities.forEach((id, quantity) -> fingerprintParts.add(id + ":" + quantity));

        String requestHash = fingerprint(fingerprintParts);

        var existing = jdbc.queryForList("""
                SELECT id, request_hash
                FROM public.orders
                WHERE user_id = ? AND idempotency_key = ?
                """,
                userId,
                request.idempotencyKey());

        if (!existing.isEmpty()) {
            var previous = existing.get(0);

            if (!requestHash.equals(previous.get("request_hash"))) {
                throw failure(
                        HttpStatus.CONFLICT,
                        "This request key was already used for different details.");
            }

            return getOrder(userId, (UUID) previous.get("id"));
        }

        if (!verifiedSafepay && Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.safepay_sessions WHERE user_id=? AND state IN ('PENDING','REVIEW'))", Boolean.class, userId)))
            throw failure(HttpStatus.CONFLICT, "You have an unfinished Safepay payment. Open card checkout to resume or check it before placing another order.");

        List<OrderLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (var entry : quantities.entrySet()) {
            var products = jdbc.queryForList("""
                    SELECT id, name, price, currency, stock, active
                    FROM public.products
                    WHERE id = ?
                    FOR UPDATE
                    """,
                    entry.getKey());

            if (products.isEmpty()) {
                throw failure(
                        HttpStatus.CONFLICT,
                        "A product is no longer available.");
            }

            var product = products.get(0);
            int quantity = entry.getValue();

            if (!Boolean.TRUE.equals(product.get("active"))
                    || !"PKR".equals(product.get("currency"))
                    || ((Number) product.get("stock")).intValue() < quantity) {
                throw failure(
                        HttpStatus.CONFLICT,
                        "Insufficient stock or unavailable product: "
                                + product.get("name"));
            }

            BigDecimal price = (BigDecimal) product.get("price");

            lines.add(new OrderLine(
                    entry.getKey(),
                    (String) product.get("name"),
                    price.toPlainString(),
                    quantity));

            subtotal = subtotal.add(
                    price.multiply(BigDecimal.valueOf(quantity)));
        }

        var pricing = vouchers.forOrder(userId, voucherCode, lines);
        if(request.expectedTotal()!=null && request.expectedTotal().compareTo(subtotal.subtract(pricing.discount()))!=0)
            throw new VoucherService.Rejected("Prices changed. Remove and apply the voucher again to confirm the new total.");
        UUID orderId = UUID.randomUUID();
        String orderNumber = "SM-" + orderId;

        // Prices and stock are checked by the server.
        // Demo payments represent no actual money collected.
        jdbc.update("""
                INSERT INTO public.orders (
                    id, order_number, user_id, idempotency_key, request_hash,
                    recipient_name, email, phone, address_line, city,
                    subtotal, shipping_fee, total, voucher_id, voucher_code, discount_amount,
                    payment_method, payment_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                orderId,
                orderNumber,
                userId,
                request.idempotencyKey(),
                requestHash,
                name,
                email,
                phone,
                address,
                city,
                subtotal,
                BigDecimal.ZERO,
                subtotal.subtract(pricing.discount()),
                pricing.voucherId(), pricing.code(), pricing.discount(),
                paymentMethod,
                paymentStatus);

        for (int lineIndex=0; lineIndex<lines.size(); lineIndex++) {
            OrderLine line=lines.get(lineIndex);
            jdbc.update("""
                    INSERT INTO public.order_items (
                        order_id, product_id, product_name, unit_price, quantity, discount_amount
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    orderId,
                    line.productId(),
                    line.name(),
                    new BigDecimal(line.price()),
                    line.quantity(), pricing.lineDiscounts().get(lineIndex));

            int updated = jdbc.update("""
                    UPDATE public.products
                    SET stock = stock - ?,
                        version = version + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND active = TRUE AND stock >= ?
                    """,
                    line.quantity(),
                    line.productId(),
                    line.quantity());

            if (updated != 1) {
                throw failure(
                        HttpStatus.CONFLICT,
                        "Stock changed. Please review your cart.");
            }
        }

        jdbc.update("""
                INSERT INTO public.order_status_history (
                    order_id, status, changed_by
                )
                VALUES (?, 'PENDING', ?)
                """,
                orderId,
                userId);

        vouchers.redeem(userId, orderId, pricing);
        notifications.orderPlaced(userId, orderId, orderNumber);

        return getOrder(userId, orderId);
    }

    @Transactional(readOnly = true)
    public OrderReceipt getOrder(UUID userId, UUID orderId) {
        var orders = jdbc.queryForList("""
                SELECT id, order_number, status, payment_method,
                       payment_status, total, currency, created_at, subtotal, discount_amount, voucher_code,
                       recipient_name, email, phone, address_line, city
                FROM public.orders
                WHERE id = ? AND user_id = ?
                """,
                orderId,
                userId);

        if (orders.isEmpty()) {
            throw failure(HttpStatus.NOT_FOUND, "Order not found.");
        }

        var order = orders.get(0);

        List<OrderLine> lines = jdbc.query("""
                SELECT product_id, product_name, unit_price, quantity, discount_amount
                FROM public.order_items
                WHERE order_id = ?
                ORDER BY product_name, product_id
                """,
                (rs, row) -> new OrderLine(
                        rs.getObject("product_id", UUID.class),
                        rs.getString("product_name"),
                        rs.getBigDecimal("unit_price").toPlainString(),
                        rs.getInt("quantity"), rs.getBigDecimal("discount_amount").toPlainString()),
                orderId);

        return new OrderReceipt(
                orderId,
                (String) order.get("order_number"),
                (String) order.get("status"),
                (String) order.get("payment_method"),
                (String) order.get("payment_status"),
                ((BigDecimal) order.get("total")).toPlainString(),
                (String) order.get("currency"),
                ((Timestamp) order.get("created_at")).toInstant(),
                lines,
                new DeliveryDetails(
                        (String) order.get("recipient_name"),
                        (String) order.get("email"),
                        (String) order.get("phone"),
                        (String) order.get("address_line"),
                        (String) order.get("city")),
                order.get("subtotal").toString(), order.get("discount_amount").toString(), (String)order.get("voucher_code"));
    }

    @Transactional(readOnly = true)
    public OrderPage getOrders(UUID userId, int page, int size) {
        if (page < 0 || size < 1 || size > 50) {
            throw failure(
                    HttpStatus.BAD_REQUEST,
                    "Page must be non-negative and size must be between 1 and 50.");
        }

        Boolean enabled = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = ? AND enabled = TRUE
                )
                """,
                Boolean.class,
                userId);

        if (!Boolean.TRUE.equals(enabled)) {
            throw failure(
                    HttpStatus.UNAUTHORIZED,
                    "Please sign in again.");
        }

        long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM public.orders WHERE user_id = ?",
                Long.class,
                userId);

        Map<UUID, OrderReceipt> results = new LinkedHashMap<>();

        jdbc.query("""
                SELECT selected.*, item.product_id, item.product_name,
                       item.unit_price, item.quantity, item.discount_amount AS line_discount
                FROM (
                    SELECT id, order_number, status, payment_method,
                           payment_status, total, currency, created_at, subtotal, discount_amount, voucher_code,
                           recipient_name, email, phone, address_line, city
                    FROM public.orders
                    WHERE user_id = ?
                    ORDER BY created_at DESC, id DESC
                    LIMIT ? OFFSET ?
                ) selected
                LEFT JOIN public.order_items item
                    ON item.order_id = selected.id
                ORDER BY selected.created_at DESC, selected.id DESC,
                         item.product_name, item.product_id
                """,
                (RowCallbackHandler) rs -> {
                    UUID orderId = rs.getObject("id", UUID.class);
                    OrderReceipt receipt = results.get(orderId);

                    if (receipt == null) {
                        receipt = new OrderReceipt(
                                orderId,
                                rs.getString("order_number"),
                                rs.getString("status"),
                                rs.getString("payment_method"),
                                rs.getString("payment_status"),
                                rs.getBigDecimal("total").toPlainString(),
                                rs.getString("currency"),
                                rs.getTimestamp("created_at").toInstant(),
                                new ArrayList<>(),
                                new DeliveryDetails(
                                        rs.getString("recipient_name"),
                                        rs.getString("email"),
                                        rs.getString("phone"),
                                        rs.getString("address_line"),
                                        rs.getString("city")),
                                rs.getBigDecimal("subtotal").toPlainString(), rs.getBigDecimal("discount_amount").toPlainString(), rs.getString("voucher_code"));

                        results.put(orderId, receipt);
                    }

                    UUID productId = rs.getObject("product_id", UUID.class);

                    if (productId != null) {
                        receipt.items().add(new OrderLine(
                                productId,
                                rs.getString("product_name"),
                                rs.getBigDecimal("unit_price").toPlainString(),
                                rs.getInt("quantity"), rs.getBigDecimal("line_discount").toPlainString()));
                    }
                },
                userId,
                size,
                (long) page * size);

        return new OrderPage(
                new ArrayList<>(results.values()),
                page,
                size,
                total,
                (int) ((total + size - 1) / size));
    }

    private static String fingerprint(List<String> parts) {
        StringBuilder value = new StringBuilder();

        for (String part : parts) {
            value.append(part.length()).append(':').append(part);
        }

        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.toString().getBytes(StandardCharsets.UTF_8));

            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static ResponseStatusException failure(
            HttpStatus status,
            String message) {
        return new ResponseStatusException(status, message);
    }
}