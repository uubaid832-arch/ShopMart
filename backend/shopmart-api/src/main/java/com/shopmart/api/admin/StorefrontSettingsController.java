package com.shopmart.api.admin;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/store/settings", "/api/mobile/store/settings"})
public class StorefrontSettingsController {
  private final AdminStoreSettingsService settings;

  public StorefrontSettingsController(AdminStoreSettingsService settings) {
    this.settings = settings;
  }

  @GetMapping
  public ResponseEntity<AdminStoreSettingsService.PublicStoreSettings> get() {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(settings.getPublicSettings());
  }
}
