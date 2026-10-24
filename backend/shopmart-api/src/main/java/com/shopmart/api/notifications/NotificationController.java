package com.shopmart.api.notifications;

import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

  private final NotificationService notifications;

  public NotificationController(NotificationService notifications) {
    this.notifications = notifications;
  }

  @GetMapping
  public ResponseEntity<NotificationService.NotificationPage> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(notifications.list(userId(jwt), page, size));
  }

  @PatchMapping("/{id}/read")
  public ResponseEntity<Void> markRead(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {
    notifications.markRead(userId(jwt), id);

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @PatchMapping("/read-all")
  public ResponseEntity<Void> markAllRead(
      @AuthenticationPrincipal Jwt jwt) {
    notifications.markAllRead(userId(jwt));

    return ResponseEntity.noContent()
        .cacheControl(CacheControl.noStore())
        .build();
  }

  private static UUID userId(Jwt jwt) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    try {
      return UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
  }
}