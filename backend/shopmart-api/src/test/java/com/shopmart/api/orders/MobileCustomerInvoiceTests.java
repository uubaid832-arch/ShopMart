package com.shopmart.api.orders;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.shopmart.api.admin.AdminOrderService;
import com.shopmart.api.security.MobileApiSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest(OrderInvoiceController.class)
@Import({com.shopmart.api.security.SecurityConfig.class, MobileApiSecurityConfig.class, MobileCustomerInvoiceTests.WebSecurity.class})
class MobileCustomerInvoiceTests {
 @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
 @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
 static class WebSecurity {}
 @Autowired MockMvc mvc;
 @MockitoBean OrderService orders;
 @MockitoBean AdminOrderService adminOrders;
 @MockitoBean OrderInvoiceService invoices;
 @MockitoBean JwtDecoder decoder;
 @MockitoBean JdbcTemplate jdbc;
 UUID user=UUID.randomUUID(),id=UUID.randomUUID();
 void token() { when(decoder.decode("test-token")).thenReturn(Jwt.withTokenValue("test-token").header("alg","test").subject(user.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120)).claim("roles",List.of("CUSTOMER")).build()); }
 @Test void anonymousCannotDownload() throws Exception {
   mvc.perform(get("/api/mobile/orders/"+id+"/invoice")).andExpect(status().isUnauthorized()); verifyNoInteractions(orders,invoices);
 }
 @Test void customerDownloadsAuthenticatedOwnedInvoice() throws Exception {
   token(); var order=mock(OrderModels.OrderReceipt.class); when(order.id()).thenReturn(id); when(orders.getOrder(user,id)).thenReturn(order); when(invoices.generate(order)).thenReturn("%PDF-test".getBytes());
   mvc.perform(get("/api/mobile/orders/"+id+"/invoice").header("Authorization","Bearer test-token")).andExpect(status().isOk()).andExpect(content().contentType("application/pdf")).andExpect(header().string("Cache-Control","no-store")).andExpect(header().string("Content-Disposition",org.hamcrest.Matchers.containsString(id.toString())));
   verify(orders).getOrder(user,id); verifyNoInteractions(adminOrders);
 }
 @Test void anotherCustomersOrderCannotDownload() throws Exception {
   token(); when(orders.getOrder(user,id)).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));
   mvc.perform(get("/api/mobile/orders/"+id+"/invoice").header("Authorization","Bearer test-token")).andExpect(status().isNotFound()); verifyNoInteractions(invoices);
 }
}
