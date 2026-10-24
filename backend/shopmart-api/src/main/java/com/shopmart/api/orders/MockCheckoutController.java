package com.shopmart.api.orders;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.OrderReceipt;

@RestController
@RequestMapping("/api/checkout")
public class MockCheckoutController {

  private final OrderService orders;

  public MockCheckoutController(OrderService orders) {
    this.orders = orders;
  }

  @PostMapping("/process-payment")
  public ResponseEntity<OrderReceipt> process(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody PaymentRequest request) {

    UUID customerId = userId(jwt);

    if (!"DEMO".equals(request.order().paymentMethod())) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "This endpoint supports test payments only.");
    }

    validatePayment(request);

    // Existing service checks prices, stock and duplicate requests.
    // Payment form details are never passed to the order service.
    OrderReceipt receipt = orders.create(customerId, request.order());

    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(receipt);
  }

  private static void validatePayment(PaymentRequest request) {
    if ("CARD".equals(request.method())) {
      validateCard(request);
    } else {
      validateWallet(request);
    }
  }

  private static void validateCard(PaymentRequest request) {
    String number = clean(request.cardNumber()).replace(" ", "");

    boolean approvedCard = "4242424242424242".equals(number);
    boolean declinedCard = "4000000000000002".equals(number);

    if (!approvedCard && !declinedCard) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Use the supplied test card number.");
    }

    if (!"Test Account".equalsIgnoreCase(clean(request.cardholderName()))
        || !"12/30".equals(clean(request.expiry()))
        || !"123".equals(request.cvv())) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Use Test Account, expiry 12/30 and test CVV 123.");
    }

    if (declinedCard) {
      throw failure(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "Test payment declined. No order was created.");
    }
  }

  private static void validateWallet(PaymentRequest request) {
    if (!"03000000000".equals(clean(request.phone()))) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Use the fictional test mobile number 03000000000.");
    }

    if ("0001".equals(request.mpin())) {
      throw failure(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "Test payment declined. No order was created.");
    }

    if (!"0000".equals(request.mpin())) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Use test MPIN 0000.");
    }
  }

  private static String clean(String value) {
    return value == null ? "" : value.strip();
  }

  private static UUID userId(Jwt jwt) {
    if (jwt == null || jwt.getSubject() == null) {
      throw failure(HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }

    try {
      return UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw failure(HttpStatus.UNAUTHORIZED, "Please sign in again.");
    }
  }

  private static ResponseStatusException failure(
      HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }

  public record PaymentRequest(
      @NotBlank @Pattern(regexp = "CARD|JAZZCASH|EASYPAISA") String method,

      @Size(max = 50) String cardholderName,
      @Size(max = 23) String cardNumber,
      @Size(max = 5) String expiry,
      @Size(max = 3) String cvv,
      @Size(max = 11) String phone,
      @Size(max = 4) String mpin,

      @NotNull @Valid CreateOrderRequest order) {

    @Override
    public String toString() {
      return "PaymentRequest[REDACTED]";
    }
  }
}