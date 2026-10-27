package com.shopmart.api.returns;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminRefundService {

    private final JdbcTemplate jdbc;

    public AdminRefundService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public void record(
            UUID adminId, UUID requestId, RefundRequest request) {
        Boolean allowed = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = ? AND enabled = TRUE AND role = 'ADMIN'
                )
                """, Boolean.class, adminId);

        if (!Boolean.TRUE.equals(allowed)) {
            throw failure(
                    HttpStatus.FORBIDDEN, "Administrator access is required.");
        }

        String reference = request.reference().strip();

        if (reference.isBlank()) {
            throw failure(
                    HttpStatus.BAD_REQUEST, "Enter a payment or receipt reference.");
        }

        var ids = jdbc.queryForList("""
                SELECT i.order_id
                FROM public.return_requests r
                JOIN public.order_items i ON i.id = r.order_item_id
                WHERE r.id = ?
                """, requestId);

        if (ids.isEmpty()) {
            throw failure(HttpStatus.NOT_FOUND, "Return request not found.");
        }

        UUID orderId = (UUID) ids.get(0).get("order_id");

        var order = jdbc.queryForMap("""
                SELECT total, payment_method, payment_status
                FROM public.orders
                WHERE id = ?
                FOR UPDATE
                """, orderId);

        var returned = jdbc.queryForMap("""
                SELECT status, refund_status, refund_amount, refund_reference
                FROM public.return_requests
                WHERE id = ?
                FOR UPDATE
                """, requestId);

        if ("REFUNDED".equals(returned.get("refund_status"))) {
            if (reference.equals(returned.get("refund_reference")))
                return;

            throw failure(
                    HttpStatus.CONFLICT,
                    "A refund has already been recorded for this request.");
        }

        if (!"APPROVED".equals(returned.get("status"))) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "Inspect and accept the returned goods before recording a refund.");
        }

        if (!"COD".equals(order.get("payment_method"))
                || !java.util.Set.of("PAID", "PARTIALLY_REFUNDED")
                        .contains(order.get("payment_status"))) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "Only paid COD orders support manual refund recording here.");
        }

        BigDecimal previous = jdbc.queryForObject("""
                SELECT COALESCE(SUM(r.refund_amount), 0)
                FROM public.return_requests r
                JOIN public.order_items i ON i.id = r.order_item_id
                WHERE i.order_id = ? AND r.refund_status = 'REFUNDED'
                """, BigDecimal.class, orderId);

        BigDecimal refunded = previous.add(
                (BigDecimal) returned.get("refund_amount"));

        BigDecimal total = (BigDecimal) order.get("total");

        if (refunded.compareTo(total) > 0) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "Recorded refunds cannot exceed the order total.");
        }

        jdbc.update("""
                UPDATE public.return_requests
                SET refund_status = 'REFUNDED',
                    refunded_by = ?,
                    refunded_at = CURRENT_TIMESTAMP,
                    refund_reference = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """, adminId, reference, requestId);

        jdbc.update("""
                UPDATE public.orders
                SET payment_status = ?,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                refunded.compareTo(total) == 0
                        ? "REFUNDED"
                        : "PARTIALLY_REFUNDED",
                orderId);
    }

    private static ResponseStatusException failure(
            HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    public record RefundRequest(
            @NotBlank @Size(max = 200) String reference) {
    }
}