package com.shopmart.api.returns;
import java.time.Instant;
import java.util.*;
import com.shopmart.api.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminSafepayRefundController.class)
@Import({SecurityConfig.class,MobileApiSecurityConfig.class,AdminSafepayRefundApiTests.WebSecurity.class})
class AdminSafepayRefundApiTests {
 @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
 @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
 static class WebSecurity {}
 @Autowired MockMvc mvc;
 @MockitoBean AdminSafepayRefundService service;
 @MockitoBean JwtDecoder decoder;
 @MockitoBean JdbcTemplate jdbc;
 UUID admin=UUID.randomUUID(),id=UUID.randomUUID();
 void token(String role){when(decoder.decode("test-token")).thenReturn(Jwt.withTokenValue("test-token").header("alg","test").subject(admin.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120)).claim("roles",List.of(role)).build());}
 String maskedCsrf(){byte[] token="test-csrf".getBytes(java.nio.charset.StandardCharsets.UTF_8);byte[] both=new byte[token.length*2];System.arraycopy(token,0,both,token.length,token.length);return Base64.getUrlEncoder().encodeToString(both);}
 @Test void anonymousBlocked() throws Exception {mvc.perform(post("/api/mobile/admin/returns/"+id+"/safepay-refund")).andExpect(status().isUnauthorized());verifyNoInteractions(service);}
 @Test void customerBlocked() throws Exception {token("CUSTOMER");mvc.perform(post("/api/mobile/admin/returns/"+id+"/safepay-refund").header("Authorization","Bearer test-token")).andExpect(status().isForbidden());verifyNoInteractions(service);}
 @Test void mobileAdminCanRefund() throws Exception {token("ADMIN");when(service.refund(admin,id)).thenReturn(new AdminSafepayRefundService.Result("CONFIRMED","confirmed"));mvc.perform(post("/api/mobile/admin/returns/"+id+"/safepay-refund").header("Authorization","Bearer test-token")).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("CONFIRMED"));verify(service).refund(admin,id);}
 @Test void webCookieRequestRequiresCsrf() throws Exception {token("ADMIN");mvc.perform(post("/api/admin/returns/"+id+"/safepay-refund").cookie(new jakarta.servlet.http.Cookie("XSRF-TOKEN","test-csrf"))).andExpect(status().isForbidden());verifyNoInteractions(service);}
 @Test void webAdminWithCsrfCanRefund() throws Exception {token("ADMIN");mvc.perform(post("/api/admin/returns/"+id+"/safepay-refund").header("Authorization","Bearer test-token").cookie(new jakarta.servlet.http.Cookie("XSRF-TOKEN","test-csrf")).header("X-XSRF-TOKEN",maskedCsrf())).andExpect(status().isOk());verify(service).refund(admin,id);}
 @Test void invalidIdBlocked() throws Exception {token("ADMIN");mvc.perform(post("/api/mobile/admin/returns/not-a-uuid/safepay-refund").header("Authorization","Bearer test-token")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
}
