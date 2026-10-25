package com.shopmart.api.cod;

import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/admin/cod","/api/mobile/admin/cod"})
public class AdminCodController {
  private final RiderCodService service;
  public AdminCodController(RiderCodService service) { this.service=service; }
  @GetMapping("/handovers")
  public ResponseEntity<RiderCodService.Page<RiderCodService.Handover>> list(@AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue="PENDING") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.history(RiderCodController.user(jwt),true,status,page,size));
  }
  @GetMapping("/handovers/{id}")
  public ResponseEntity<RiderCodService.Details> details(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.details(RiderCodController.user(jwt),true,id));
  }
  @PatchMapping("/handovers/{id}")
  public ResponseEntity<Void> decide(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody RiderCodService.DecisionRequest request) {
    service.decide(RiderCodController.user(jwt),id,request);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }
}
