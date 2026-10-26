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
            @NotEmpty @Size(max = 50) List<@NotNull @Valid ItemRequest> items,
            @Size(max = 40) String voucherCode,
            @DecimalMin("0.01") @Digits(integer=18,fraction=2) java.math.BigDecimal expectedTotal) {
        public CreateOrderRequest(UUID idempotencyKey,String name,String email,String phone,String address,String city,String paymentMethod,List<ItemRequest> items) {
            this(idempotencyKey,name,email,phone,address,city,paymentMethod,items,null,null);
        }
    }

    public record ItemRequest(
            @NotNull UUID productId,
            @Min(1) @Max(999) int quantity) {
    }

    public record OrderLine(
            UUID productId,
            String name,
            String price,
            int quantity,
            String discountAmount) {
        public OrderLine(UUID productId,String name,String price,int quantity) { this(productId,name,price,quantity,"0.00"); }
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
            DeliveryDetails delivery,
            String subtotal,
            String discountAmount,
            String voucherCode,
            String paymentProvider) {
        public OrderReceipt(UUID id,String orderNumber,String status,String paymentMethod,String paymentStatus,String total,String currency,Instant createdAt,List<OrderLine> items,DeliveryDetails delivery,String subtotal,String discountAmount,String voucherCode) {
            this(id,orderNumber,status,paymentMethod,paymentStatus,total,currency,createdAt,items,delivery,subtotal,discountAmount,voucherCode,null);
        }
        public OrderReceipt(UUID id,String orderNumber,String status,String paymentMethod,String paymentStatus,String total,String currency,Instant createdAt,List<OrderLine> items,DeliveryDetails delivery) {
            this(id,orderNumber,status,paymentMethod,paymentStatus,total,currency,createdAt,items,delivery,total,"0.00",null);
        }
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