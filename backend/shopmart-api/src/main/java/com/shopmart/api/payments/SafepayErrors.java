package com.shopmart.api.payments;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestControllerAdvice(assignableTypes=SafepayController.class)
public class SafepayErrors {
 @ExceptionHandler(ResponseStatusException.class) public ResponseEntity<Map<String,String>> status(ResponseStatusException error){return ResponseEntity.status(error.getStatusCode()).body(Map.of("message",error.getReason()==null?"The Safepay request could not be confirmed.":error.getReason()));}
}
