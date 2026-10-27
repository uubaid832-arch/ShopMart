package com.shopmart.api.cod;
import java.util.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.shopmart.api.security.SecurityConfig;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest(RiderCodController.class)
@Import({SecurityConfig.class,RiderWebCodApiTests.WebSecurity.class})
class RiderWebCodApiTests {
 @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
 @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity static class WebSecurity {}
 @Autowired MockMvc mvc; @MockitoBean RiderCodService service; @MockitoBean JwtDecoder decoder; @MockitoBean JdbcTemplate jdbc;
 UUID user=UUID.randomUUID();
 void token(String role){when(decoder.decode("token")).thenReturn(Jwt.withTokenValue("token").header("alg","test").subject(user.toString()).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(120)).claim("roles",List.of(role)).build());}
 @Test void anonymousCannotReadCash() throws Exception{mvc.perform(get("/api/rider/dashboard")).andExpect(status().isUnauthorized());verifyNoInteractions(service);}
 @Test void customerCannotReadRiderCash() throws Exception{token("CUSTOMER");mvc.perform(get("/api/rider/dashboard").header("Authorization","Bearer token")).andExpect(status().isForbidden());verifyNoInteractions(service);}
 @Test void riderCanReadOwnCash() throws Exception{token("RIDER");mvc.perform(get("/api/rider/dashboard").header("Authorization","Bearer token")).andExpect(status().isOk());verify(service).dashboard(user);}
 @Test void cookieOnlyHandoverRequiresCsrf() throws Exception{token("RIDER");mvc.perform(post("/api/rider/cod/handovers").cookie(new jakarta.servlet.http.Cookie("XSRF-TOKEN","test-csrf")).contentType("application/json").content("{}" )).andExpect(status().isForbidden());verifyNoInteractions(service);}
}
