package com.shopmart.api.payments;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.vouchers.VoucherController;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/checkout/safepay","/api/mobile/checkout/safepay"})
public class SafepayController {
 private final SafepayService service;
 public SafepayController(SafepayService service){this.service=service;}
 public record Create(@NotNull @Valid CreateOrderRequest order,@NotBlank @Pattern(regexp="web|mobile") String source) {}
 @PostMapping("/sessions") public ResponseEntity<SafepayService.Session> create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Create request){return result(service.create(VoucherController.user(jwt),request.order(),request.source()));}
 @GetMapping("/sessions/active") public ResponseEntity<SafepayService.Session> active(@AuthenticationPrincipal Jwt jwt){return result(service.active(VoucherController.user(jwt)));}
 @GetMapping("/sessions/{id}") public ResponseEntity<SafepayService.Session> get(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return result(service.get(VoucherController.user(jwt),id));}
 @PostMapping("/sessions/{id}/resume") public ResponseEntity<SafepayService.Session> resume(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return result(service.resume(VoucherController.user(jwt),id));}
 @PostMapping("/sessions/{id}/verify") public ResponseEntity<SafepayService.Session> verify(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return result(service.verify(VoucherController.user(jwt),id));}
 @GetMapping(value="/return",produces=MediaType.TEXT_HTML_VALUE) public ResponseEntity<String> complete(){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body("<!doctype html><html lang='en'><meta name='viewport' content='width=device-width,initial-scale=1'><title>ShopMart payment</title><body><h2>Return to ShopMart</h2><p>You may close this checkout window. ShopMart will check your payment securely with Safepay. This page does not confirm payment.</p></body></html>");}
 private static <T> ResponseEntity<T> result(T value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
}
