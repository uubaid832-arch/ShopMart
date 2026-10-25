package com.shopmart.api.vouchers;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping({"/api/admin/vouchers","/api/mobile/admin/vouchers"})
public class AdminVoucherController {
  private final AdminVoucherService service;
  public AdminVoucherController(AdminVoucherService service){this.service=service;}
  @GetMapping public ResponseEntity<AdminVoucherService.Page> list(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(VoucherController.user(jwt),page,size));}
  @PostMapping public ResponseEntity<AdminVoucherService.Voucher> create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody AdminVoucherService.CreateRequest request){return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(service.create(VoucherController.user(jwt),request));}
  @PatchMapping("/{id}") public ResponseEntity<Void> toggle(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody AdminVoucherService.ToggleRequest request){service.toggle(VoucherController.user(jwt),id,request);return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();}
}
