package com.shopmart.api.payments;
import java.time.Instant;import java.util.*;
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

@WebMvcTest(SafepayController.class)
@Import({SecurityConfig.class,MobileApiSecurityConfig.class,SafepayApiTests.WebSecurity.class})
class SafepayApiTests {
 @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
 @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
 static class WebSecurity {}
 @Autowired MockMvc mvc;@MockitoBean SafepayService service;@MockitoBean JwtDecoder decoder;@MockitoBean JdbcTemplate jdbc;
 UUID user=UUID.randomUUID(),id=UUID.randomUUID();
 String maskedCsrf(){byte[] token="test-csrf".getBytes(java.nio.charset.StandardCharsets.UTF_8);byte[] combined=new byte[token.length*2];System.arraycopy(token,0,combined,token.length,token.length);return Base64.getUrlEncoder().encodeToString(combined);}
 void token(){when(decoder.decode("test-token")).thenReturn(Jwt.withTokenValue("test-token").header("alg","test").subject(user.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120)).claim("roles",List.of("CUSTOMER")).build());}
 @Test void anonymousCannotVerifyOrReadCheckout() throws Exception {mvc.perform(post("/api/mobile/checkout/safepay/sessions/"+id+"/verify")).andExpect(status().isUnauthorized());mvc.perform(get("/api/mobile/checkout/safepay/sessions/"+id)).andExpect(status().isUnauthorized());verifyNoInteractions(service);}
 @Test void mobileVerificationUsesAuthenticatedOwner() throws Exception {token();mvc.perform(post("/api/mobile/checkout/safepay/sessions/"+id+"/verify").header("Authorization","Bearer test-token")).andExpect(status().isOk());verify(service).verify(user,id);}
 @Test void webCookieRequestsRequireCsrfAndBearerRequestsRemainAuthenticated() throws Exception {token();mvc.perform(post("/api/checkout/safepay/sessions/"+id+"/verify").cookie(new jakarta.servlet.http.Cookie("XSRF-TOKEN","test-csrf"))).andExpect(status().isForbidden());verifyNoInteractions(service);mvc.perform(post("/api/checkout/safepay/sessions/"+id+"/verify").header("Authorization","Bearer test-token").cookie(new jakarta.servlet.http.Cookie("XSRF-TOKEN","test-csrf")).header("X-XSRF-TOKEN", maskedCsrf())).andExpect(status().isOk());verify(service).verify(user,id);}
 @Test void redirectCannotConfirmPayment() throws Exception {mvc.perform(get("/api/checkout/safepay/return?tracker=fake&success=true")).andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("does not confirm payment")));verifyNoInteractions(service);}
 @Test void activeCheckoutIsScopedToCaller() throws Exception {token();mvc.perform(get("/api/mobile/checkout/safepay/sessions/active").header("Authorization","Bearer test-token")).andExpect(status().isOk());verify(service).active(user);}
 @Test void invalidCreateDoesNotCallProviderService() throws Exception {token();mvc.perform(post("/api/mobile/checkout/safepay/sessions").header("Authorization","Bearer test-token").contentType("application/json").content("{\"source\":\"mobile\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
}
