package com.shopmart.api.vouchers;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
@RequestMapping({"/api/vouchers","/api/mobile/vouchers"})
public class VoucherController {
  private final VoucherService service;
  public VoucherController(VoucherService service){this.service=service;}
  @PostMapping("/quote")
  public ResponseEntity<VoucherService.Quote> quote(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody VoucherService.QuoteRequest request){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.quote(user(jwt),request));}
  public static UUID user(Jwt jwt){try{if(jwt==null||jwt.getSubject()==null)throw new IllegalArgumentException();return UUID.fromString(jwt.getSubject());}catch(IllegalArgumentException failure){throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);}}
}
