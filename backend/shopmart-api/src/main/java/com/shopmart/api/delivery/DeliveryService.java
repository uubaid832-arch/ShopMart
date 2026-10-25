package com.shopmart.api.delivery;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

import com.shopmart.api.notifications.NotificationService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
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
public class DeliveryService {

    private final JdbcTemplate jdbc;
    private final NotificationService notifications;

    public DeliveryService(
            JdbcTemplate jdbc,
            NotificationService notifications) {
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public DeliveryPage list(UUID adminId, int page, int size) {
        return list(adminId, page, size, "ALL");
    }

    @Transactional(readOnly = true)
    public DeliveryPage list(UUID adminId, int page, int size, String filterStatus) {
        requireAdmin(adminId);
        if (!java.util.Set.of("ALL", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED", "RETURNED").contains(filterStatus)) {
            throw failure(HttpStatus.BAD_REQUEST, "Invalid delivery status.");
        }

        if (page < 0 || size < 1 || size > 50) {
            throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
        }

        long total = jdbc.queryForObject("""
                SELECT COUNT(*)
                FROM public.orders o
                LEFT JOIN public.delivery_assignments a ON a.order_id = o.id
                WHERE (o.status IN ('CONFIRMED', 'DISPATCHED') OR a.id IS NOT NULL)
                  AND (? = 'ALL' OR o.status = ?)
                """, Long.class, filterStatus, filterStatus);

        List<DeliveryResponse> items = jdbc.query("""
                SELECT o.id AS order_id, o.order_number,
                       o.recipient_name, o.email,
                       o.address_line, o.city, o.phone,
                       o.status, a.rider_id, r.name AS rider_name,
                       r.enabled AS rider_enabled,
                       attempt.reason AS failure_reason,
                       attempt.note AS failure_note
                FROM public.orders o
                LEFT JOIN public.delivery_assignments a ON a.order_id = o.id
                LEFT JOIN public.users r ON r.id = a.rider_id
                LEFT JOIN LATERAL (
                    SELECT reason, note
                    FROM public.delivery_attempts
                    WHERE order_id = o.id AND resolved_at IS NULL
                    ORDER BY created_at DESC, id DESC
                    LIMIT 1
                ) attempt ON TRUE
                WHERE (o.status IN ('CONFIRMED', 'DISPATCHED') OR a.id IS NOT NULL)
                  AND (? = 'ALL' OR o.status = ?)
                ORDER BY o.created_at DESC, o.id DESC
                LIMIT ? OFFSET ?
                """,
                (rs, row) -> {
                    String status = rs.getString("status");
                    String failureReason = rs.getString("failure_reason");

                    boolean canEdit = "CONFIRMED".equals(status)
                            || ("DISPATCHED".equals(status)
                                    && failureReason != null);

                    return new DeliveryResponse(
                            rs.getObject("order_id", UUID.class),
                            rs.getString("order_number"),
                            rs.getString("recipient_name"),
                            rs.getString("address_line") + ", " + rs.getString("city"),
                            rs.getString("phone"),
                            status,
                            rs.getObject("rider_id", UUID.class),
                            rs.getString("rider_name"),
                            rs.getBoolean("rider_enabled"),
                            rs.getString("email"),
                            rs.getString("address_line"),
                            rs.getString("city"),
                            failureReason,
                            rs.getString("failure_note"),
                            canEdit);
                },
                filterStatus, filterStatus, size, (long) page * size);

        return new DeliveryPage(
                items, page, size, total,
                (int) ((total + size - 1) / size));
    }

    @Transactional(readOnly = true)
    public List<RiderResponse> riders(UUID adminId) {
        requireAdmin(adminId);

        return jdbc.query("""
                SELECT id, name
                FROM public.users
                WHERE role = 'RIDER' AND enabled = TRUE
                ORDER BY name, id
                """,
                (rs, row) -> new RiderResponse(
                        rs.getObject("id", UUID.class),
                        rs.getString("name")));
    }

    @Transactional
    public void assign(UUID adminId, UUID orderId, UUID riderId) {
        requireAdmin(adminId);

        var orders = jdbc.queryForList("""
                SELECT status
                FROM public.orders
                WHERE id = ?
                FOR UPDATE
                """, orderId);

        if (orders.isEmpty()) {
            throw failure(HttpStatus.NOT_FOUND, "Order not found.");
        }

        String status = (String) orders.get(0).get("status");

        List<UUID> existing = jdbc.query("""
                SELECT rider_id
                FROM public.delivery_assignments
                WHERE order_id = ?
                """,
                (rs, row) -> rs.getObject("rider_id", UUID.class),
                orderId);

        UUID previousRiderId = existing.isEmpty() ? null : existing.get(0);

        boolean confirmed = "CONFIRMED".equals(status);
        boolean repairUnassignedDispatch = "DISPATCHED".equals(status) && previousRiderId == null;

        if (!confirmed && !repairUnassignedDispatch) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "Riders cannot be changed after dispatch.");
        }

        var riders = jdbc.queryForList("""
                SELECT id
                FROM public.users
                WHERE id = ? AND role = 'RIDER' AND enabled = TRUE
                FOR SHARE
                """, riderId);

        if (riders.isEmpty()) {
            throw failure(
                    HttpStatus.BAD_REQUEST,
                    "Select an enabled rider account.");
        }

        if (riderId.equals(previousRiderId)) {
            return;
        }

        jdbc.update("""
                INSERT INTO public.delivery_assignments (
                    order_id, rider_id, assigned_by
                )
                VALUES (?, ?, ?)
                ON CONFLICT (order_id)
                DO UPDATE SET
                    rider_id = EXCLUDED.rider_id,
                    assigned_by = EXCLUDED.assigned_by,
                    assigned_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                """, orderId, riderId, adminId);

        notifications.deliveryAssigned(orderId, riderId, previousRiderId);
    }

    @Transactional
    public void updateDetails(
            UUID adminId,
            UUID orderId,
            @Valid DeliveryDetailsRequest request) {
        requireAdmin(adminId);

        var matches = jdbc.queryForList("""
                SELECT user_id, order_number, status,
                       recipient_name, email, phone, address_line, city
                FROM public.orders
                WHERE id = ?
                FOR UPDATE
                """, orderId);

        if (matches.isEmpty()) {
            throw failure(HttpStatus.NOT_FOUND, "Order not found.");
        }

        var order = matches.get(0);
        String status = (String) order.get("status");

        boolean hasFailedAttempt = Boolean.TRUE.equals(
                jdbc.queryForObject("""
                        SELECT EXISTS (
                            SELECT 1 FROM public.delivery_attempts
                            WHERE order_id = ?
                        )
                        """, Boolean.class, orderId));

        boolean editable = "PENDING".equals(status)
                || "CONFIRMED".equals(status)
                || ("DISPATCHED".equals(status) && hasFailedAttempt);

        if (!editable) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "Delivery details cannot be edited at this order stage.");
        }

        String name = request.name().strip();
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        String phone = request.phone();
        String address = request.addressLine().strip();
        String city = request.city().strip();

        if (name.isBlank() || address.isBlank() || city.isBlank()) {
            throw failure(
                    HttpStatus.BAD_REQUEST,
                    "Please complete the delivery details.");
        }

        boolean unchanged = Objects.equals(order.get("recipient_name"), name)
                && Objects.equals(order.get("email"), email)
                && Objects.equals(order.get("phone"), phone)
                && Objects.equals(order.get("address_line"), address)
                && Objects.equals(order.get("city"), city);

        if (unchanged) {
            return;
        }

        UUID changeId = UUID.randomUUID();

        // Capture the old details before updating the order.
        jdbc.update("""
                INSERT INTO public.order_delivery_changes (
                    id, order_id, changed_by,
                    previous_details, updated_details
                )
                SELECT ?, o.id, ?,
                       jsonb_build_object(
                           'name', o.recipient_name,
                           'email', o.email,
                           'phone', o.phone,
                           'addressLine', o.address_line,
                           'city', o.city
                       ),
                       jsonb_build_object(
                           'name', CAST(? AS TEXT),
                           'email', CAST(? AS TEXT),
                           'phone', CAST(? AS TEXT),
                           'addressLine', CAST(? AS TEXT),
                           'city', CAST(? AS TEXT)
                       )
                FROM public.orders o
                WHERE o.id = ?
                """,
                changeId, adminId,
                name, email, phone, address, city,
                orderId);

        jdbc.update("""
                UPDATE public.orders
                SET recipient_name = ?,
                    email = ?,
                    phone = ?,
                    address_line = ?,
                    city = ?,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, name, email, phone, address, city, orderId);

        String number = (String) order.get("order_number");
        String event = "DELIVERY_DETAILS:" + changeId;

        jdbc.update("""
                INSERT INTO public.notifications (
                    user_id, event_key, type, title, message, order_id
                )
                VALUES (?, ?, 'DELIVERY_DETAILS', ?, ?, ?)
                ON CONFLICT (user_id, event_key) DO NOTHING
                """,
                order.get("user_id"),
                event,
                "Delivery details updated",
                "The delivery details for order " + number
                        + " were updated by the administrator.",
                orderId);

        jdbc.update("""
                INSERT INTO public.notifications (
                    user_id, event_key, type, title, message, order_id
                )
                SELECT a.rider_id, ?, 'DELIVERY_DETAILS', ?, ?, a.order_id
                FROM public.delivery_assignments a
                JOIN public.users u ON u.id = a.rider_id
                WHERE a.order_id = ?
                  AND u.enabled = TRUE
                  AND u.role = 'RIDER'
                ON CONFLICT (user_id, event_key) DO NOTHING
                """,
                event,
                "Check updated delivery details",
                "Order " + number
                        + " has updated contact or address details."
                        + " Refresh your deliveries before the next attempt.",
                orderId);
    }

    private void requireAdmin(UUID userId) {
        Boolean allowed = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = ? AND enabled = TRUE AND role = 'ADMIN'
                )
                """, Boolean.class, userId);

        if (!Boolean.TRUE.equals(allowed)) {
            throw failure(
                    HttpStatus.FORBIDDEN,
                    "Administrator access is required.");
        }
    }

    private static ResponseStatusException failure(
            HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    public record AssignmentRequest(@NotNull UUID riderId) {
    }

    public record DeliveryDetailsRequest(
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Pattern(regexp = "[0-9]{11}") String phone,
            @NotBlank @Size(max = 500) String addressLine,
            @NotBlank @Size(max = 150) String city) {
    }

    public record RiderResponse(UUID id, String name) {
    }

    public record DeliveryResponse(
            UUID orderId,
            String orderNumber,
            String customerName,
            String address,
            String phone,
            String status,
            UUID riderId,
            String riderName,
            boolean riderEnabled,
            String email,
            String addressLine,
            String city,
            String failureReason,
            String failureNote,
            boolean canEditDetails) {
    }

    public record DeliveryPage(
            List<DeliveryResponse> items,
            int page,
            int size,
            long totalItems,
            int totalPages) {
    }
}