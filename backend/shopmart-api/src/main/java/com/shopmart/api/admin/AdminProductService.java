package com.shopmart.api.admin;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

import com.shopmart.api.catalog.ProductImageService;

import jakarta.validation.constraints.*;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminProductService {

    private final JdbcTemplate jdbc;
    private final ProductImageService images;

    public AdminProductService(
            JdbcTemplate jdbc,
            ProductImageService images) {
        this.jdbc = jdbc;
        this.images = images;
    }

    @Transactional(readOnly = true)
    public ProductPage list(UUID adminId, int page, int size) {
        requireAdmin(adminId);

        if (page < 0 || size < 1 || size > 100) {
            throw failure(HttpStatus.BAD_REQUEST, "Invalid pagination.");
        }

        long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM public.products",
                Long.class);

        List<ProductResponse> items = jdbc.query("""
                SELECT p.*, c.name AS category_name
                FROM public.products p
                JOIN public.categories c ON c.id = p.category_id
                ORDER BY p.name, p.id
                LIMIT ? OFFSET ?
                """,
                this::mapProduct,
                size,
                (long) page * size);

        return new ProductPage(
                items, page, size, total,
                (int) ((total + size - 1) / size));
    }

    @Transactional
    public ProductResponse create(UUID adminId, ProductRequest request) {
        requireAdmin(adminId);
        requireCategory(request.categoryId());

        UUID id = UUID.randomUUID();

        jdbc.update("""
                INSERT INTO public.products (
                    id, category_id, name, description, price, currency,
                    stock, active, illustration, color
                )
                VALUES (?, ?, ?, ?, ?, 'PKR', ?, ?, 'headphones', 'lavender')
                """,
                id,
                request.categoryId(),
                request.name().strip(),
                cleanDescription(request.description()),
                request.price(),
                request.stock(),
                request.active());

        return find(id);
    }

    @Transactional
    public ProductResponse update(
            UUID adminId,
            UUID id,
            ProductRequest request) {
        requireAdmin(adminId);
        requireCategory(request.categoryId());

        int updated = jdbc.update("""
                UPDATE public.products
                SET category_id = ?,
                    name = ?,
                    description = ?,
                    price = ?,
                    stock = ?,
                    active = ?,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND version = ?
                """,
                request.categoryId(),
                request.name().strip(),
                cleanDescription(request.description()),
                request.price(),
                request.stock(),
                request.active(),
                id,
                request.version());

        if (updated == 0) {
            Boolean exists = jdbc.queryForObject("""
                    SELECT EXISTS (
                        SELECT 1 FROM public.products WHERE id = ?
                    )
                    """, Boolean.class, id);

            if (!Boolean.TRUE.equals(exists)) {
                throw failure(HttpStatus.NOT_FOUND, "Product not found.");
            }

            throw failure(
                    HttpStatus.CONFLICT,
                    "This product changed. Reload the product list before editing again.");
        }

        return find(id);
    }

    @Transactional
    public void delete(UUID adminId, UUID id, long version) {
        requireAdmin(adminId);

        var products = jdbc.queryForList("""
                SELECT version
                FROM public.products
                WHERE id = ?
                FOR UPDATE
                """, id);

        if (products.isEmpty()) {
            throw failure(
                    HttpStatus.NOT_FOUND,
                    "Product not found.");
        }

        long currentVersion = ((Number) products.get(0).get("version")).longValue();

        if (version != currentVersion) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "This product changed. Refresh before deleting it.");
        }

        Boolean ordered = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM public.order_items
                    WHERE product_id = ?
                )
                """, Boolean.class, id);

        if (Boolean.TRUE.equals(ordered)) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "This product belongs to an order. Deactivate it instead.");
        }

        Boolean reviewed = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM public.product_reviews
                    WHERE product_id = ?
                )
                """, Boolean.class, id);

        if (Boolean.TRUE.equals(reviewed)) {
            throw failure(
                    HttpStatus.CONFLICT,
                    "This product has reviews. Deactivate it instead.");
        }

        // Joins this transaction. Physical files are deleted after commit.
        images.deleteAllForProduct(adminId, id);

        try {
            jdbc.update("""
                    DELETE FROM public.products
                    WHERE id = ?
                    """, id);
        } catch (DataIntegrityViolationException exception) {
            // Rolling back also restores image rows and preserves image files.
            throw failure(
                    HttpStatus.CONFLICT,
                    "This product has linked records. Deactivate it instead.");
        }
    }

    private ProductResponse find(UUID id) {
        return jdbc.queryForObject("""
                SELECT p.*, c.name AS category_name
                FROM public.products p
                JOIN public.categories c ON c.id = p.category_id
                WHERE p.id = ?
                """, this::mapProduct, id);
    }

    private ProductResponse mapProduct(
            ResultSet rs,
            int row) throws SQLException {
        return new ProductResponse(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getObject("category_id", UUID.class),
                rs.getString("category_name"),
                rs.getBigDecimal("price").toPlainString(),
                rs.getInt("stock"),
                rs.getBoolean("active"),
                rs.getLong("version"),
                cleanDescription(rs.getString("description")));
    }

    private static String cleanDescription(String value) {
        return value == null ? "" : value.strip();
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

    private void requireCategory(UUID id) {
        Boolean exists = jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM public.categories WHERE id = ?
                )
                """, Boolean.class, id);

        if (!Boolean.TRUE.equals(exists)) {
            throw failure(
                    HttpStatus.BAD_REQUEST,
                    "Select a valid category.");
        }
    }

    private static ResponseStatusException failure(
            HttpStatus status,
            String message) {
        return new ResponseStatusException(status, message);
    }

    public record ProductRequest(
            @NotBlank @Size(max = 150) String name,
            @NotNull UUID categoryId,
            @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal price,
            @NotNull @Min(0) Integer stock,
            @NotNull Boolean active,
            @NotNull @Min(0) Long version,
            @Size(max = 4000) String description) {

        // Preserve compatibility with callers using the original request fields.
        public ProductRequest(
                String name,
                UUID categoryId,
                BigDecimal price,
                Integer stock,
                Boolean active,
                Long version) {
            this(name, categoryId, price, stock, active, version, "");
        }
    }

    public record ProductResponse(
            UUID id,
            String name,
            UUID categoryId,
            String category,
            String price,
            int stock,
            boolean active,
            long version,
            String description) {
    }

    public record ProductPage(
            List<ProductResponse> items,
            int page,
            int size,
            long totalItems,
            int totalPages) {
    }
}