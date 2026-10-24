package com.shopmart.api.admin;

import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {

  private final AdminDashboardService dashboard;

  public AdminDashboardController(AdminDashboardService dashboard) {
    this.dashboard = dashboard;
  }

  @GetMapping
  public ResponseEntity<AdminDashboardService.DashboardResponse> get(
      @AuthenticationPrincipal Jwt jwt) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    UUID adminId;

    try {
      adminId = UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(dashboard.get(adminId));
  }
}