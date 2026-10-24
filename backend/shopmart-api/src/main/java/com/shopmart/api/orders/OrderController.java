package com.shopmart.api.orders;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.OrderPage;
import com.shopmart.api.orders.OrderModels.OrderReceipt;

import static com.shopmart.api.orders.OrderModels.*;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

  private final OrderService orders;

  public OrderController(OrderService orders) {
    this.orders = orders;
  }

  @PostMapping
  public ResponseEntity<OrderReceipt> create(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody CreateOrderRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(orders.create(userId(jwt), request));
  }

  @GetMapping("/{id}")
  public OrderReceipt getOrder(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    return orders.getOrder(userId(jwt), id);
  }

  private static UUID userId(Jwt jwt) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    try {
      return UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
  }

  @GetMapping
  public OrderPage getOrders(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return orders.getOrders(userId(jwt), page, size);
  }
}
