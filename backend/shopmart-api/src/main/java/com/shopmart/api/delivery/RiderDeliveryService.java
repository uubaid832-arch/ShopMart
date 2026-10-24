package com.shopmart.api.delivery;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.shopmart.api.notifications.NotificationService;
import com.shopmart.api.orders.OrderPaymentRules;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;

@Service
@Validated
public class RiderDeliveryService {

    private final JdbcTemplate jdbc;
    private final NotificationService notifications;

    public RiderDeliveryService(
            JdbcTemplate jdbc,
            NotificationService notifications) {
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public DeliveryPage list(UUID riderId, int page, int size) {
        requireRider(riderId);

        if (page < 0 || size < 1 || size > 50) {
            throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
        }

        long total = jdbc.queryForObject("""
                SELECT COUNT(*)
                FROM public.delivery_assignments
                WHERE rider_id = ?
                """, Long.class, riderId);

        List<RiderDelivery> items = jdbc.query("""
                SELECT o.id, o.order_number, o.recipient_name,
                       o.address_line, o.city, o.phone,
                       o.status, o.payment_method, o.payment_status,
                       o.total, o.currency,
                       attempt.reason AS attempt_reason,
                       attempt.note AS attempt_note,
                       attempt.created_at AS attempt_at
                FROM public.delivery_assignments a
                JOIN public.orders o ON o.id = a.order_id
                LEFT JOIN LATERAL (
                    SELECT reason, note, created_at
                    FROM public.delivery_attempts
                    WHERE order_id = o.id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                ) attempt ON TRUE
                WHERE a.rider_id = ?
                ORDER BY a.assigned_at DESC, o.id DESC
                LIMIT ? OFFSET ?
                """,
                (rs, row) -> {
                    var attemptAt = rs.getTimestamp("attempt_at");

                    DeliveryAttempt lastAttempt = attemptAt == null
                            ? null
                            : new DeliveryAttempt(
                                    rs.getString("attempt_reason"),
                                    rs.getString("attempt_note"),
                                    attemptAt.toInstant());

                    return new RiderDelivery(
                            rs.getObject("id", UUID.class),
                            rs.getString("order_number"),
                            rs.getString("recipient_name"),
                            rs.getString("address_line") + ", " + rs.getString("city"),
                            rs.getString("phone"),
                            rs.getString("status"),
                            rs.getString("payment_method"),
                            rs.getString("payment_status"),
                            rs.getBigDecimal("total").toPlainString(),
                            rs.getString("currency"),
                            lastAttempt);
                },
                riderId, size, (long) page * size);

        return new DeliveryPage(
                items, page, size, total,
                (int) ((total + size - 1) / size));
    }

    @Transactional
    public void complete(UUID riderId, UUID orderId) {
        requireRider(riderId);

        var order = lockDelivery(riderId, orderId);

        // Retrying a completed delivery must not record another status change.
        if ("DELIVERED".equals(order.get("status"))) {
            return;
        }

        requireDispatchedDelivery(order);
        requireParcelOutsideWarehouse(orderId);

        // Only COD becomes PAID. Demo payments never record actual cash.
        jdbc.update("""
                UPDATE public.orders
                SET status = 'DELIVERED',
                    payment_status = CASE
                        WHEN payment_method = 'DEMO' THEN 'DEMO_PAID'
                        ELSE 'PAID'
                    END,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, orderId);

        jdbc.update("""
                INSERT INTO public.order_status_history (
                    order_id, status, changed_by
                )
                VALUES (?, 'DELIVERED', ?)
                """, orderId, riderId);

        notifications.orderStatusChanged(orderId, "DELIVERED");
    }

    @Transactional
    public void reportFailure(
            UUID riderId,
            UUID orderId,
            @Valid FailureRequest request) {
        requireRider(riderId);

        var order = lockDelivery(riderId, orderId);
        String note = request.note() == null ? "" : request.note().strip();

        if ("OTHER".equals(request.reason()) && note.isBlank()) {
            throw failure(
                    HttpStatus.BAD_REQUEST,
                    "Please explain the delivery problem.");
        }

        // A retry of the same request must not create another attempt.
        var existing = jdbc.queryForList("""
                SELECT order_id, rider_id, reason, note
                FROM public.delivery_attempts
                WHERE id = ?
                """, request.requestId());

        if (!existing.isEmpty()) {
            var saved = existing.get(0);

            if (Objects.equals(saved.get("order_id"), orderId)
                    && Objects.equals(saved.get("rider_id"), riderId)
                    && Objects.equals(saved.get("reason"), request.reason())
                    && Objects.equals(saved.get("note"), note)) {
                return;
            }

            throw failure(
                    HttpStatus.CONFLICT,
                    "This request identifier was already used.");
        }

        requireDispatchedDelivery(order);
        requireParcelOutsideWarehouse(orderId);

        int inserted = jdbc.update("""
                INSERT INTO public.delivery_attempts (
                    id, order_id, rider_id, reason, note
                )
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
                """,
                request.requestId(), orderId, riderId, request.reason(), note);

        if (inserted != 1) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "This request identifier was already used.");
        }

        String number = (String) order.get("order_number");
        String reason = reasonLabel(request.reason());
        String event = "DELIVERY_FAILED:" + request.requestId();

        String paymentMessage = "DEMO".equals(order.get("payment_method"))
                ? " This is a demo payment; no money was charged."
                : " No cash payment was recorded.";

        // An unsuccessful attempt does not change payment, status or stock.
        jdbc.update("""
                INSERT INTO public.notifications (
                    user_id, event_key, type, title, message, order_id
                )
                VALUES (?, ?, 'DELIVERY_FAILED', ?, ?, ?)
                ON CONFLICT (user_id, event_key) DO NOTHING
                """,
                order.get("user_id"),
                event,
                "Delivery attempt unsuccessful",
                "Your order " + number + " could not be delivered: "
                        + reason + "." + paymentMessage,
                orderId);

        jdbc.update("""
                INSERT INTO public.notifications (
                    user_id, event_key, type, title, message, order_id
                )
                SELECT id, ?, 'DELIVERY_FAILED', ?, ?, ?
                FROM public.users
                WHERE role = 'ADMIN' AND enabled = TRUE
                ON CONFLICT (user_id, event_key) DO NOTHING
                """,
                event,
                "Delivery needs attention",
                "Order " + number + ": " + reason + "."
                        + (note.isBlank() ? "" : " Rider note: " + note),
                orderId);
    }

    private Map<String, Object> lockDelivery(
            UUID riderId, UUID orderId) {
        var matches = jdbc.queryForList("""
                SELECT o.status, o.payment_method, o.payment_status,
                       o.user_id, o.order_number
                FROM public.orders o
                JOIN public.delivery_assignments a ON a.order_id = o.id
                WHERE o.id = ? AND a.rider_id = ?
                FOR UPDATE OF o
                """, orderId, riderId);

        if (matches.isEmpty()) {
            throw failure(HttpStatus.NOT_FOUND, "Delivery not found.");
        }

        return matches.get(0);
    }

    private void requireDispatchedDelivery(Map<String, Object> order) {
        if (!"DISPATCHED".equals(order.get("status"))
                || !OrderPaymentRules.supportsDelivery(order)) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "Only dispatched COD or successful demo-payment orders support this action.");
        }
    }

    private void requireParcelOutsideWarehouse(UUID orderId) {
        Boolean returning = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM public.delivery_attempts
                    WHERE order_id = ?
                      AND warehouse_reported_at IS NOT NULL
                      AND resolved_at IS NULL
                )
                """, Boolean.class, orderId);

        if (Boolean.TRUE.equals(returning)) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "This parcel is in the warehouse return process."
                            + " Wait for the administrator to arrange another delivery.");
        }
    }

    private static String reasonLabel(String reason) {
        return switch (reason) {
            case "CUSTOMER_REFUSED" -> "Customer refused the order";
            case "CUSTOMER_UNAVAILABLE" -> "Customer was unavailable";
            case "UNREACHABLE" -> "Customer could not be contacted";
            case "INCORRECT_ADDRESS" -> "Incorrect or incomplete address";
            case "DAMAGED_PACKAGE" -> "Package was damaged";
            default -> "Other delivery problem";
        };
    }

    private void requireRider(UUID userId) {
        Boolean allowed = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = ? AND enabled = TRUE AND role = 'RIDER'
                )
                """, Boolean.class, userId);

        if (!Boolean.TRUE.equals(allowed)) {
            throw failure(
                    HttpStatus.FORBIDDEN,
                    "Delivery rider access is required.");
        }
    }

    private static ResponseStatusException failure(
            HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    public record FailureRequest(
            @NotNull UUID requestId,
            @NotBlank @Pattern(regexp = "CUSTOMER_REFUSED|CUSTOMER_UNAVAILABLE|UNREACHABLE|"
                    + "INCORRECT_ADDRESS|DAMAGED_PACKAGE|OTHER") String reason,
            @Size(max = 500) String note) {
    }

    public record DeliveryAttempt(
            String reason,
            String note,
            Instant createdAt) {
    }

    public record RiderDelivery(
            UUID id,
            String orderNumber,
            String customerName,
            String address,
            String phone,
            String status,
            String paymentMethod,
            String paymentStatus,
            String total,
            String currency,
            DeliveryAttempt lastAttempt) {
    }

    public record DeliveryPage(
            List<RiderDelivery> items,
            int page,
            int size,
            long totalItems,
            int totalPages) {
    }
}