package com.shopmart.api.orders;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class OrderModels {

    private OrderModels() {
    }

    public record CreateOrderRequest(
            @NotNull UUID idempotencyKey,
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 32) String phone,
            @NotBlank @Size(max = 500) String address,
            @NotBlank @Size(max = 150) String city,
            @NotBlank @Pattern(regexp = "COD|DEMO") String paymentMethod,
            @NotEmpty @Size(max = 50) List<@NotNull @Valid ItemRequest> items) {
    }

    public record ItemRequest(
            @NotNull UUID productId,
            @Min(1) @Max(999) int quantity) {
    }

    public record OrderLine(
            UUID productId,
            String name,
            String price,
            int quantity) {
    }

    public record OrderReceipt(
            UUID id,
            String orderNumber,
            String status,
            String paymentMethod,
            String paymentStatus,
            String total,
            String currency,
            Instant createdAt,
            List<OrderLine> items,
            DeliveryDetails delivery) {
    }

    public record DeliveryDetails(
            String name,
            String email,
            String phone,
            String address,
            String city) {
    }

    public record OrderPage(
            List<OrderReceipt> items,
            int page,
            int size,
            long totalItems,
            int totalPages) {
    }
}