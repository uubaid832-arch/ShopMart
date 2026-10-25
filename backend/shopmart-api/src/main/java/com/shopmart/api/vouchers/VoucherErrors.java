package com.shopmart.api.vouchers;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class VoucherErrors {
  @ExceptionHandler(VoucherService.Rejected.class)
  public ResponseEntity<Map<String,String>> rejected(VoucherService.Rejected failure){return ResponseEntity.status(409).body(Map.of("message",failure.getMessage()));}
}
