package com.shopmart.api.admin;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.shopmart.api.delivery.AdminDeliveryController;
import com.shopmart.api.delivery.DeliveryService;
import com.shopmart.api.orders.OrderModels.OrderReceipt;
import com.shopmart.api.security.MobileApiSecurityConfig;
import com.shopmart.api.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// MVC and security tests only: no database, real mail, order updates or cash movements.
@WebMvcTest(controllers = {AdminDashboardController.class, AdminOrderController.class, AdminDeliveryController.class, com.shopmart.api.orders.OrderInvoiceController.class})
@Import({SecurityConfig.class, MobileApiSecurityConfig.class, MobileAdminApiTests.WebSecurity.class})
class MobileAdminApiTests {
  @TestConfiguration(proxyBeanMethods = false)
  @EnableWebSecurity
  static class WebSecurity {}

  @Autowired MockMvc mvc;
  @MockitoBean JwtDecoder decoder;
  @MockitoBean AdminDashboardService dashboard;
  @MockitoBean AdminOrderService orders;
  @MockitoBean DeliveryService deliveries;
  @MockitoBean JdbcTemplate jdbc;
  @MockitoBean com.shopmart.api.orders.OrderService customerOrders;
  @MockitoBean com.shopmart.api.orders.OrderInvoiceService invoices;
  private static final UUID ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID ORDER_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final UUID RIDER = UUID.fromString("00000000-0000-0000-0000-000000000003");

  private void token(String role) {
    when(decoder.decode("test-token")).thenReturn(Jwt.withTokenValue("test-token")
        .header("alg", "test-only").subject(ADMIN.toString())
        .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120))
        .claim("roles", List.of(role)).build());
  }
  private String[][] routes() {
    return new String[][] {
        {"GET", "/dashboard"}, {"GET", "/orders"}, {"GET", "/orders/" + ORDER_ID},
        {"GET", "/orders/" + ORDER_ID + "/history"}, {"GET", "/orders/" + ORDER_ID + "/invoice"},
        {"GET", "/deliveries/riders"}, {"GET", "/deliveries/" + ORDER_ID + "/assignment"},
        {"PATCH", "/orders/" + ORDER_ID + "/status"},
        {"PUT", "/deliveries/" + ORDER_ID + "/assignment"}
    };
  }

  @Test void anonymousRequestsCannotReadOrModifyAdminData() throws Exception {
    for (var route : routes()) {
      mvc.perform(request(HttpMethod.valueOf(route[0]), "/api/mobile/admin" + route[1])
          .contentType("application/json").content("{}"))
          .andExpect(status().isUnauthorized());
    }
    verifyNoInteractions(dashboard, orders, deliveries, jdbc);
  }

  @ParameterizedTest @ValueSource(strings = {"CUSTOMER", "RIDER"})
  void otherRolesCannotReadOrModifyAdminData(String role) throws Exception {
    token(role);
    for (var route : routes()) {
      mvc.perform(request(HttpMethod.valueOf(route[0]), "/api/mobile/admin" + route[1])
          .header("Authorization", "Bearer test-token").contentType("application/json").content("{}"))
          .andExpect(status().isForbidden());
    }
    verifyNoInteractions(dashboard, orders, deliveries, jdbc);
  }

  @Test void adminCanDownloadPdfAndReadHistoryWithoutWebCookies() throws Exception {
    token("ADMIN");
    var receipt = new OrderReceipt(ORDER_ID, "SM-TEST", "DELIVERED", "COD", "PAID", "100.00", "PKR", Instant.now(), List.of(), null);
    when(orders.get(ADMIN, ORDER_ID)).thenReturn(receipt);
    when(invoices.generate(receipt)).thenReturn("%PDF-test".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
    mvc.perform(get("/api/mobile/admin/orders/"+ORDER_ID+"/invoice").header("Authorization","Bearer test-token"))
        .andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
        .andExpect(header().string("Cache-Control","no-store"));
    when(orders.history(ADMIN,ORDER_ID)).thenReturn(List.of(new AdminOrderService.HistoryEntry("DELIVERED", Instant.parse("2026-10-25T10:00:00Z"), "Rider")));
    mvc.perform(get("/api/mobile/admin/orders/"+ORDER_ID+"/history").header("Authorization","Bearer test-token"))
        .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("DELIVERED"));
    verifyNoInteractions(customerOrders);
  }

  @Test void adminCanReadDashboardAndPaginatedOrders() throws Exception {
    token("ADMIN");
    when(dashboard.get(ADMIN)).thenReturn(new AdminDashboardService.DashboardResponse(
        5, 2, 8, "18200.00", "PKR", List.of(), List.of(), 3, 2));
    when(orders.list(ADMIN, 1, 15)).thenReturn(new AdminOrderService.OrderPage(List.of(), 1, 15, 20, 2));
    mvc.perform(get("/api/mobile/admin/dashboard").header("Authorization", "Bearer test-token"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.paidRevenue").value("18200.00"))
        .andExpect(header().string("Cache-Control", "no-store"));
    mvc.perform(get("/api/mobile/admin/orders?page=1&size=15").header("Authorization", "Bearer test-token"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(1))
        .andExpect(jsonPath("$.totalItems").value(20));
  }

  @Test void adminCanUpdateStatusWithBearerWithoutWebCsrf() throws Exception {
    token("ADMIN");
    var request = new AdminOrderService.StatusRequest("CONFIRMED");
    when(orders.updateStatus(ADMIN, ORDER_ID, request)).thenReturn(new OrderReceipt(
        ORDER_ID, "SM-TEST", "CONFIRMED", "COD", "UNPAID", "100.00", "PKR", Instant.now(), List.of(), null));
    mvc.perform(patch("/api/mobile/admin/orders/" + ORDER_ID + "/status")
        .header("Authorization", "Bearer test-token").contentType("application/json")
        .content("{\"status\":\"CONFIRMED\"}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONFIRMED"));
    verify(orders).updateStatus(ADMIN, ORDER_ID, request);
  }

  @Test void adminCannotUseThisEndpointToMarkDelivered() throws Exception {
    token("ADMIN");
    mvc.perform(patch("/api/mobile/admin/orders/" + ORDER_ID + "/status")
        .header("Authorization", "Bearer test-token").contentType("application/json")
        .content("{\"status\":\"DELIVERED\"}"))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(orders);
  }

  @Test void adminCanListRidersAndAssignAnOrder() throws Exception {
    token("ADMIN");
    when(deliveries.riders(ADMIN)).thenReturn(List.of(new DeliveryService.RiderResponse(RIDER, "Test Rider")));
    mvc.perform(get("/api/mobile/admin/deliveries/riders").header("Authorization", "Bearer test-token"))
        .andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Test Rider"));
    mvc.perform(put("/api/mobile/admin/deliveries/" + ORDER_ID + "/assignment")
        .header("Authorization", "Bearer test-token").contentType("application/json")
        .content("{\"riderId\":\"" + RIDER + "\"}"))
        .andExpect(status().isNoContent());
    verify(deliveries).assign(ADMIN, ORDER_ID, RIDER);
  }

  @Test void webCookieRequestsStillRequireCsrf() throws Exception {
    mvc.perform(patch("/api/admin/orders/" + ORDER_ID + "/status")
        .contentType("application/json")
        .content("{\"status\":\"CONFIRMED\"}"))
        .andExpect(status().isForbidden());
    verifyNoInteractions(orders);
  }

  @Test void unlistedMobileAdminWritesRemainDenied() throws Exception {
    token("ADMIN");
    mvc.perform(delete("/api/mobile/admin/orders/" + ORDER_ID).header("Authorization", "Bearer test-token"))
        .andExpect(status().isForbidden());
    verifyNoInteractions(orders);
  }
}
