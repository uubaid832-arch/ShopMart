package com.shopmart.api.catalog;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = ProductImageController.class)
public class ProductImageErrors {
  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> status(ResponseStatusException error) {
    String message = error.getStatusCode().is4xxClientError() ? error.getReason()
        : "Image storage is temporarily unavailable. Check the Cloudinary configuration and try again.";
    return ResponseEntity.status(error.getStatusCode()).body(Map.of("message",
        message == null ? "The image request could not be completed." : message));
  }
}
