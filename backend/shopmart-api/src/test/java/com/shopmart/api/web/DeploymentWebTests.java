package com.shopmart.api.web;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.shopmart.api.HealthController;
import com.shopmart.api.auth.RefreshCookieService;
import com.shopmart.api.auth.RefreshSessionService;
import com.shopmart.api.auth.SessionController;
import com.shopmart.api.security.SecurityConfig;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// MVC-only tests: no real database, mail delivery or Cloudinary uploads.
@WebMvcTest(controllers = {SpaController.class, HealthController.class, SessionController.class},
    properties = "shopmart.auth.cookie-secure=true")
@ActiveProfiles("production")
@Import({SecurityConfig.class, RefreshCookieService.class, DeploymentWebTests.TestWebSecurity.class})
class DeploymentWebTests {
  @TestConfiguration(proxyBeanMethods = false)
  @EnableWebSecurity
  static class TestWebSecurity {}

  @Autowired MockMvc mvc;
  @Autowired RefreshCookieService cookies;
  @MockitoBean JwtDecoder decoder;
  @MockitoBean RefreshSessionService sessions;

  @ParameterizedTest
  @ValueSource(strings = {"/", "/admin", "/admin/products", "/admin/orders", "/rider", "/rider/assignments"})
  void pageLinksForwardToReactShell(String path) throws Exception {
    mvc.perform(get(path)).andExpect(status().isOk()).andExpect(forwardedUrl("/index.html"));
  }

  @Test void compiledEntryPointAndAssetsArePublic() throws Exception {
    mvc.perform(get("/index.html")).andExpect(status().isOk())
        .andExpect(content().string(containsString("ShopMart deployment test shell")));
    mvc.perform(get("/assets/deployment-probe.js")).andExpect(status().isOk())
        .andExpect(content().string(containsString("shopmartDeploymentProbe")));
  }

  @Test void healthCheckDoesNotRequireSignIn() throws Exception {
    mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
  }

  @Test void adminApiStillRequiresAuthentication() throws Exception {
    mvc.perform(get("/api/admin/dashboard")).andExpect(status().isUnauthorized())
        .andExpect(result -> assertNull(result.getResponse().getForwardedUrl()));
  }

  @Test void customerTokenCannotAccessAdminApi() throws Exception {
    var token = org.springframework.security.oauth2.jwt.Jwt.withTokenValue("customer-test-token")
        .header("alg", "test-only").subject("test-user")
        .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60))
        .claim("roles", java.util.List.of("CUSTOMER")).build();
    when(decoder.decode("customer-test-token")).thenReturn(token);
    mvc.perform(get("/api/admin/dashboard").header("Authorization", "Bearer customer-test-token"))
        .andExpect(status().isForbidden());
  }

  @Test void unknownApiCannotFallBackToReactHtml() throws Exception {
    mvc.perform(get("/api/not-a-real-endpoint")).andExpect(status().isUnauthorized())
        .andExpect(result -> assertNull(result.getResponse().getForwardedUrl()));
  }

  @Test void loginPostStillRequiresCsrf() throws Exception {
    mvc.perform(post("/api/auth/login").contentType("application/json")
        .content("{\"email\":\"test@example.invalid\",\"password\":\"test-only\"}"))
        .andExpect(status().isForbidden());
  }

  @Test void productionCsrfCookieIsSecureAndHttpOnly() throws Exception {
    mvc.perform(get("/api/auth/csrf").secure(true)).andExpect(status().isOk())
        .andExpect(result -> {
          String cookie = result.getResponse().getHeader("Set-Cookie");
          assertNotNull(cookie);
          assertTrue(cookie.contains("Secure"));
          assertTrue(cookie.contains("HttpOnly"));
          var csrfCookie = result.getResponse().getCookie("XSRF-TOKEN");
          assertNotNull(csrfCookie);
          assertEquals("Strict", csrfCookie.getAttribute("SameSite"));
        });
  }

  @Test void productionRefreshCookieIsSecureAndHttpOnly() {
    MockHttpServletResponse response = new MockHttpServletResponse();
    cookies.write(response, "test-only-token", Instant.now().plusSeconds(60));
    String cookie = response.getHeader("Set-Cookie");
    assertNotNull(cookie);
    assertTrue(cookie.contains("Secure"));
    assertTrue(cookie.contains("HttpOnly"));
    assertTrue(cookie.contains("SameSite=Strict"));
  }
}
