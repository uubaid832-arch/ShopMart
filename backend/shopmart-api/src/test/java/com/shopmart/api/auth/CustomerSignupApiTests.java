package com.shopmart.api.auth;
import java.util.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.shopmart.api.security.SecurityConfig;
import com.shopmart.api.security.MobileAuthSecurityConfig;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@WebMvcTest({AuthController.class,MobileAuthController.class})
@Import({SecurityConfig.class,MobileAuthSecurityConfig.class,CustomerSignupApiTests.WebSecurity.class})
class CustomerSignupApiTests {
 @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods=false)
 @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity static class WebSecurity {}
 @Autowired MockMvc mvc;
 @MockitoBean CustomerSignupService signup; @MockitoBean AuthService auth; @MockitoBean EmailOtpService otp; @MockitoBean UserAccountRepository users; @MockitoBean RefreshCookieService cookies; @MockitoBean RefreshSessionService sessions; @MockitoBean JwtDecoder decoder; @MockitoBean JdbcTemplate jdbc;
 String body="{\"name\":\"Customer\",\"email\":\"customer@example.test\",\"password\":\"password123\"}";
 UUID id=UUID.randomUUID();
 @Test void mobileRegistrationStartsChallengeNotAccount() throws Exception{
  when(signup.start(any(),eq("MOBILE"),anyString())).thenReturn(new EmailOtpService.ChallengeResponse(id,Instant.now().plusSeconds(300),Instant.now().plusSeconds(60)));
  mvc.perform(post("/api/mobile/auth/register").contentType("application/json").content(body)).andExpect(status().isAccepted()).andExpect(jsonPath("$.challengeId").value(id.toString()));verifyNoInteractions(auth);
 }
 @Test void mobileVerificationUsesSignupOnly() throws Exception{
  mvc.perform(post("/api/mobile/auth/register/verify").contentType("application/json").content("{\"challengeId\":\""+id+"\",\"code\":\"123456\"}")).andExpect(status().isCreated());verify(signup).verify(any(),eq("MOBILE"),anyString());verifyNoInteractions(auth);
 }
 @Test void mobileResendIsPublicButNotAccountCreation() throws Exception{
  mvc.perform(post("/api/mobile/auth/register/resend").contentType("application/json").content("{\"challengeId\":\""+id+"\"}")).andExpect(status().isOk());verify(signup).resend(any(),eq("MOBILE"),anyString());verifyNoInteractions(auth);
 }
 @Test void malformedCodeCannotReachSignupService() throws Exception{
  mvc.perform(post("/api/mobile/auth/register/verify").contentType("application/json").content("{\"challengeId\":\""+id+"\",\"code\":\"bad\"}")).andExpect(status().isBadRequest());verifyNoInteractions(signup);
 }
 @Test void webRegistrationStillRequiresCsrf() throws Exception{
  mvc.perform(post("/api/auth/register").contentType("application/json").content(body)).andExpect(status().isForbidden());verifyNoInteractions(signup);
 }
}
