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
    public AvailabilityResponse availability(UUID riderId) {
        List<Boolean> rows = jdbc.query("""
                SELECT rider_available
                FROM public.users
                WHERE id = ? AND enabled = TRUE AND role = 'RIDER'
                """, (rs, row) -> rs.getBoolean("rider_available"), riderId);
        if (rows.isEmpty()) {
            throw failure(HttpStatus.FORBIDDEN, "Delivery rider access is required.");
        }
        return new AvailabilityResponse(rows.get(0));
    }

    @Transactional
    public AvailabilityResponse setAvailability(UUID riderId, boolean available) {
        int updated = jdbc.update("""
                UPDATE public.users
                SET rider_available = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND enabled = TRUE AND role = 'RIDER'
                """, available, riderId);
        if (updated == 0) {
            throw failure(HttpStatus.FORBIDDEN, "Delivery rider access is required.");
        }
        return new AvailabilityResponse(available);
    }

    @Transactional(readOnly = true)
    public DeliveryPage list(UUID riderId, int page, int size) {
        return list(riderId, page, size, "ALL");
    }

    @Transactional(readOnly = true)
    public DeliveryPage list(UUID riderId, int page, int size, String section) {
        return list(riderId, page, size, section, "");
    }

    @Transactional(readOnly = true)
    public DeliveryPage list(UUID riderId, int page, int size, String section, String query) {
        requireRider(riderId);
        String search = query == null ? "" : query.strip();
        String deliveredByRider = "EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_id=o.id AND h.changed_by=rider.id AND h.status='DELIVERED')";
        String activeForRider = "a.rider_id = rider.id AND o.status NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED') AND NOT EXISTS (SELECT 1 FROM public.delivery_attempts pending WHERE pending.order_id=o.id AND pending.rider_id=rider.id AND pending.warehouse_reported_at IS NOT NULL AND pending.resolved_at IS NULL)";
        String returnedByRider = "EXISTS (SELECT 1 FROM public.delivery_attempts returned WHERE returned.order_id=o.id AND returned.rider_id=rider.id AND returned.warehouse_reported_at IS NOT NULL AND NOT COALESCE((returned.resolution='RETRY' AND returned.resolution_rider_id=rider.id AND a.rider_id=rider.id), FALSE) AND NOT EXISTS (SELECT 1 FROM public.order_status_history delivered_after WHERE delivered_after.order_id=o.id AND delivered_after.changed_by=rider.id AND delivered_after.status='DELIVERED' AND delivered_after.created_at > returned.warehouse_reported_at))";
        String filter = switch (section) {
            case "ALL" -> "(" + activeForRider + " OR " + deliveredByRider + " OR " + returnedByRider + ")";
            case "DELIVERED" -> deliveredByRider;
            case "FAILED", "CANCELLED" -> returnedByRider;
            case "ASSIGNED" -> activeForRider;
            default -> throw failure(HttpStatus.BAD_REQUEST, "Invalid delivery section.");
        };

        if (page < 0 || size < 1 || size > 50) {
            throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
        }

        long total = jdbc.queryForObject("""
                WITH rider AS (SELECT ?::uuid AS id)
                SELECT COUNT(*)
                FROM public.orders o
                LEFT JOIN public.delivery_assignments a ON a.order_id = o.id
                CROSS JOIN rider
                WHERE (%s)
                  AND (? = '' OR o.order_number ILIKE '%%' || ? || '%%' OR o.recipient_name ILIKE '%%' || ? || '%%')
                """.formatted(filter), Long.class, riderId, search, search, search);

        List<RiderDelivery> items = jdbc.query("""
                WITH rider AS (SELECT ?::uuid AS id)
                SELECT o.id, o.order_number, o.recipient_name,
                       o.address_line, o.city, o.phone,
                       CASE
                           WHEN %s THEN 'DELIVERED'
                           WHEN %s THEN o.status
                           WHEN %s THEN 'RETURNED_TO_WAREHOUSE'
                           ELSE o.status
                       END AS rider_status,
                       o.payment_method,
                       CASE
                           WHEN %s THEN CASE WHEN o.payment_method='DEMO' THEN 'DEMO_PAID' ELSE 'PAID' END
                           WHEN %s THEN o.payment_status
                           WHEN %s THEN 'NOT_COLLECTED'
                           ELSE o.payment_status
                       END AS rider_payment_status,
                       o.total, o.currency,
                       attempt.reason AS attempt_reason,
                       attempt.note AS attempt_note,
                       attempt.created_at AS attempt_at,
                       EXISTS (
                           SELECT 1 FROM public.delivery_attempts pending_return
                           WHERE pending_return.order_id = o.id
                             AND pending_return.rider_id = rider.id
                             AND pending_return.warehouse_reported_at IS NOT NULL
                             AND pending_return.resolved_at IS NULL
                       ) AS warehouse_return_pending
                FROM public.orders o
                LEFT JOIN public.delivery_assignments a ON a.order_id = o.id
                CROSS JOIN rider
                LEFT JOIN LATERAL (
                    SELECT id, reason, note, created_at, resolved_at, resolution
                    FROM public.delivery_attempts
                    WHERE order_id = o.id AND rider_id = rider.id
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                ) attempt ON TRUE
                WHERE (%s)
                  AND (? = '' OR o.order_number ILIKE '%%' || ? || '%%' OR o.recipient_name ILIKE '%%' || ? || '%%')
                ORDER BY COALESCE(a.assigned_at, o.updated_at) DESC, o.id DESC
                LIMIT ? OFFSET ?
                """.formatted(deliveredByRider, activeForRider, returnedByRider, deliveredByRider, activeForRider, returnedByRider, filter),
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
                            rs.getString("rider_status"),
                            rs.getString("payment_method"),
                            rs.getString("rider_payment_status"),
                            rs.getBigDecimal("total").toPlainString(),
                            rs.getString("currency"),
                            lastAttempt,
                            rs.getBoolean("warehouse_return_pending"));
                },
                riderId, search, search, search, size, (long) page * size);

        return new DeliveryPage(
                items, page, size, total,
                (int) ((total + size - 1) / size));
    }

    @Transactional
    public void confirmPickup(UUID riderId, UUID orderId) {
        requireRider(riderId);
        var order = lockDelivery(riderId, orderId);
        String status = (String) order.get("status");

        // A retry after a successful request is safe, including if the rider
        // already started the next step.
        if ("PICKED_UP".equals(status) || "DISPATCHED".equals(status)) return;
        if (!"CONFIRMED".equals(status) || !OrderPaymentRules.supportsDelivery(order)) {
            throw failure(HttpStatus.CONFLICT,
                    "Only a confirmed, assigned order can be picked up.");
        }
        requireParcelOutsideWarehouse(orderId);

        jdbc.update("""
                UPDATE public.orders
                SET status = 'PICKED_UP', version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, orderId);
        jdbc.update("""
                INSERT INTO public.order_status_history (order_id, status, changed_by)
                VALUES (?, 'PICKED_UP', ?)
                """, orderId, riderId);
        notifications.orderStatusChanged(orderId, "PICKED_UP");
    }

    @Transactional
    public void startDelivery(UUID riderId, UUID orderId) {
        requireRider(riderId);
        var order = lockDelivery(riderId, orderId);
        String status = (String) order.get("status");
        if ("DISPATCHED".equals(status)) return;
        if (!"PICKED_UP".equals(status) || !OrderPaymentRules.supportsDelivery(order)) {
            throw failure(HttpStatus.CONFLICT,
                    "Confirm warehouse pickup before starting delivery.");
        }
        requireParcelOutsideWarehouse(orderId);

        jdbc.update("""
                UPDATE public.orders
                SET status = 'DISPATCHED', version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, orderId);
        jdbc.update("""
                INSERT INTO public.order_status_history (order_id, status, changed_by)
                VALUES (?, 'DISPATCHED', ?)
                """, orderId, riderId);
        notifications.orderStatusChanged(orderId, "DISPATCHED");
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

        // COD cash is recorded here; admin-confirmed bank transfers are already PAID.
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
                    "Only dispatched COD, Safepay, or admin-confirmed bank transfer orders support this action.");
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

    public record AvailabilityRequest(@NotNull Boolean available) {}

    public record AvailabilityResponse(boolean available) {}

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
            DeliveryAttempt lastAttempt,
            boolean warehouseReturnPending) {
    }

    public record DeliveryPage(
            List<RiderDelivery> items,
            int page,
            int size,
            long totalItems,
            int totalPages) {
    }
}
