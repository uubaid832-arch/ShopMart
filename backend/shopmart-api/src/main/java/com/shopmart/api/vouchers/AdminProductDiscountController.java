package com.shopmart.api.vouchers;

import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/admin/product-discounts", "/api/mobile/admin/product-discounts"})
public class AdminProductDiscountController {
  private final ProductDiscountService service;
  public AdminProductDiscountController(ProductDiscountService service) { this.service=service; }

  @GetMapping
  public ResponseEntity<List<ProductDiscountService.Campaign>> list(@AuthenticationPrincipal Jwt jwt) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(VoucherController.user(jwt)));
  }
  @PostMapping
  public ResponseEntity<ProductDiscountService.Campaign> create(@AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody ProductDiscountService.CreateRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(service.create(VoucherController.user(jwt),request));
  }
  @PutMapping("/{id}")
  public ResponseEntity<ProductDiscountService.Campaign> edit(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,
      @Valid @RequestBody ProductDiscountService.EditRequest request) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.edit(VoucherController.user(jwt),id,request));
  }
  @PatchMapping("/{id}")
  public ResponseEntity<Void> toggle(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,
      @Valid @RequestBody ProductDiscountService.ToggleRequest request) {
    service.toggle(VoucherController.user(jwt),id,request);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> deleteDisabled(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
    service.deleteDisabled(VoucherController.user(jwt),id);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }
}
