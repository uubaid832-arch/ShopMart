package com.shopmart.api.web;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Profile("production")
public class SpaController {
  // The React router handles these page routes. API and asset paths are separate.
  @GetMapping({"/", "/admin", "/admin/**", "/rider", "/rider/**"})
  public String page() {
    return "forward:/index.html";
  }
}
