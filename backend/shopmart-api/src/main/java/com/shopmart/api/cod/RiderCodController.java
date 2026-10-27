package com.shopmart.api.cod;

import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping({"/api/mobile/rider", "/api/rider"})
public class RiderCodController {
  private final RiderCodService service;
  public RiderCodController(RiderCodService service) { this.service=service; }
  static UUID user(Jwt jwt) {
    try { if(jwt==null) throw new IllegalArgumentException(); return UUID.fromString(jwt.getSubject()); }
    catch(IllegalArgumentException|NullPointerException error) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED); }
  }
  private static <T> ResponseEntity<T> ok(T value) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value); }
  @GetMapping("/dashboard")
  public ResponseEntity<RiderCodService.Dashboard> dashboard(@AuthenticationPrincipal Jwt jwt) { return ok(service.dashboard(user(jwt))); }
  @GetMapping("/cod/collections")
  public ResponseEntity<RiderCodService.Page<RiderCodService.Collection>> collections(@AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return ok(service.available(user(jwt),page,size)); }
  @GetMapping("/cod/handovers")
  public ResponseEntity<RiderCodService.Page<RiderCodService.Handover>> history(@AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue="ALL") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
    return ok(service.history(user(jwt),false,status,page,size));
  }
  @GetMapping("/cod/handovers/{id}")
  public ResponseEntity<RiderCodService.Details> details(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) { return ok(service.details(user(jwt),false,id)); }
  @PostMapping("/cod/handovers")
  public ResponseEntity<Map<String,UUID>> report(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody RiderCodService.ReportRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(Map.of("id",service.report(user(jwt),request)));
  }
}
