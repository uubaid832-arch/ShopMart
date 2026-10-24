package com.shopmart.api.admin;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminDashboardService {

        private final JdbcTemplate jdbc;

        public AdminDashboardService(JdbcTemplate jdbc) {
                this.jdbc = jdbc;
        }

        @Transactional(readOnly = true)
        public DashboardResponse get(UUID adminId) {
                Boolean allowed = jdbc.queryForObject("""
                                SELECT EXISTS (
                                    SELECT 1 FROM public.users
                                    WHERE id = ? AND enabled = TRUE AND role = 'ADMIN'
                                )
                                """, Boolean.class, adminId);

                if (!Boolean.TRUE.equals(allowed)) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Administrator access is required.");
                }
                var totals = jdbc.queryForMap("""
                                                SELECT COUNT(*) AS total_orders,
                                                       COUNT(*) FILTER (
                                                           WHERE o.status = 'PENDING'
                                                       ) AS pending_orders,
                                                       COALESCE(SUM(
                                                           CASE
                                WHEN o.payment_method <> 'DEMO'
                                    AND o.payment_status IN (
                                        'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'
                                    )
                                                               THEN o.total - COALESCE((
                                                                   SELECT SUM(r.refund_amount)
                                                                   FROM public.return_requests r
                                                                   JOIN public.order_items i
                                                                     ON i.id = r.order_item_id
                                                                   WHERE i.order_id = o.id
                                                                     AND r.refund_status = 'REFUNDED'
                                                               ), 0)
                                                               ELSE 0
                                                           END
                                                       ) FILTER (WHERE o.currency = 'PKR'), 0) AS paid_revenue
                                                FROM public.orders o
                                                """);

                long activeProducts = jdbc.queryForObject("""
                                SELECT COUNT(*)
                                FROM public.products
                                WHERE active = TRUE
                                """, Long.class);

                List<RecentOrder> recentOrders = jdbc.query("""
                                SELECT o.id, o.order_number, u.name AS customer_name,
                                       o.status, o.total, o.currency, o.created_at
                                FROM public.orders o
                                JOIN public.users u ON u.id = o.user_id
                                ORDER BY o.created_at DESC, o.id DESC
                                LIMIT 5
                                """,
                                (rs, row) -> new RecentOrder(
                                                rs.getObject("id", UUID.class),
                                                rs.getString("order_number"),
                                                rs.getString("customer_name"),
                                                rs.getString("status"),
                                                rs.getBigDecimal("total").toPlainString(),
                                                rs.getString("currency"),
                                                rs.getTimestamp("created_at").toInstant()));

                List<LowStockProduct> lowStockProducts = jdbc.query("""
                                SELECT id, name, stock
                                FROM public.products
                                WHERE active = TRUE AND stock <= 5
                                ORDER BY stock, name, id
                                LIMIT 8
                                """,
                                (rs, row) -> new LowStockProduct(
                                                rs.getObject("id", UUID.class),
                                                rs.getString("name"),
                                                rs.getInt("stock")));
                var accountCounts = jdbc.queryForMap("""
                                SELECT
                                    COUNT(*) FILTER (
                                        WHERE role = 'CUSTOMER' AND enabled = TRUE
                                    ) AS active_customers,
                                    COUNT(*) FILTER (
                                        WHERE role = 'RIDER' AND enabled = TRUE
                                    ) AS active_riders
                                FROM public.users
                                """);

                return new DashboardResponse(
                                ((Number) totals.get("total_orders")).longValue(),
                                ((Number) totals.get("pending_orders")).longValue(),
                                activeProducts,
                                totals.get("paid_revenue").toString(),
                                "PKR",
                                recentOrders,
                                lowStockProducts,
                                ((Number) accountCounts.get("active_customers")).longValue(),
                                ((Number) accountCounts.get("active_riders")).longValue());
        }

        public record DashboardResponse(
                        long totalOrders,
                        long pendingOrders,
                        long activeProducts,
                        String paidRevenue,
                        String currency,
                        List<RecentOrder> recentOrders,
                        List<LowStockProduct> lowStockProducts,
                        long activeCustomers,
                        long activeRiders) {
        }

        public record RecentOrder(
                        UUID id,
                        String orderNumber,
                        String customerName,
                        String status,
                        String total,
                        String currency,
                        Instant createdAt) {
        }

        public record LowStockProduct(
                        UUID id,
                        String name,
                        int stock) {
        }
}