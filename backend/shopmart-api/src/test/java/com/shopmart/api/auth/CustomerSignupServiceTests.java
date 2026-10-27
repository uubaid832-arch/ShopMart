package com.shopmart.api.auth;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
class CustomerSignupServiceTests {
 JdbcTemplate jdbc; UserAccountRepository users; PasswordEncoder passwords; OtpCrypto crypto; OtpMailService mail; CustomerSignupService service;
 UUID id=UUID.randomUUID(); Map<String,Object> row;
 @BeforeEach void setup(){
  jdbc=mock(JdbcTemplate.class);users=mock(UserAccountRepository.class);passwords=mock(PasswordEncoder.class);mail=mock(OtpMailService.class);
  crypto=new OtpCrypto("test-signup-secret-at-least-thirty-two-bytes");
  service=new CustomerSignupService(jdbc,users,passwords,crypto,mock(OtpRateLimiter.class),mail);
  row=new HashMap<>(Map.of("email","customer@example.test","name","Customer","password_hash","encoded-password","code_digest",crypto.codeDigest(id,"SIGNUP_WEB","123456"),"attempts",0,"consumed",false,"expires_at",Timestamp.from(Instant.now().plusSeconds(300)),"resend_at",Timestamp.from(Instant.now().minusSeconds(1))));
  when(jdbc.queryForList(anyString(),eq(id),eq("WEB"))).thenReturn(List.of(row));
  when(users.saveAndFlush(any(UserAccount.class))).thenAnswer(call->call.getArgument(0));
  when(passwords.encode(anyString())).thenReturn("encoded-password");
 }
 @Test void startingSignupDoesNotCreateUser(){var challenge=service.start(new AuthService.RegisterRequest("Customer","CUSTOMER@example.test","password123"),"WEB","ip");assertNotNull(challenge.challengeId());verify(users,never()).saveAndFlush(any());verify(mail).sendSignup(eq("customer@example.test"),matches("[0-9]{6}"));}
 @Test void correctCodeCreatesCustomerWithExistingPasswordHash(){service.verify(new EmailOtpService.VerifyRequest(id,"123456"),"WEB","ip");var saved=ArgumentCaptor.forClass(UserAccount.class);verify(users).saveAndFlush(saved.capture());assertEquals("CUSTOMER",saved.getValue().getRole());assertEquals("encoded-password",saved.getValue().getPasswordHash());verify(passwords,never()).encode(anyString());}
 @Test void wrongCodeNeverCreatesUserAndConsumesAnAttempt(){assertThrows(EmailOtpService.OtpDeniedException.class,()->service.verify(new EmailOtpService.VerifyRequest(id,"000000"),"WEB","ip"));verify(users,never()).saveAndFlush(any());verify(jdbc).update(contains("attempts=attempts+1"),eq(id));}
 @Test void expiredCodeDoesNotCreateUser(){row.put("expires_at",Timestamp.from(Instant.now().minusSeconds(1)));assertThrows(EmailOtpService.OtpDeniedException.class,()->service.verify(new EmailOtpService.VerifyRequest(id,"123456"),"WEB","ip"));verify(users,never()).saveAndFlush(any());}
 @Test void replayCannotCreateUser(){row.put("consumed",true);assertThrows(EmailOtpService.OtpDeniedException.class,()->service.verify(new EmailOtpService.VerifyRequest(id,"123456"),"WEB","ip"));}
 @Test void fiveWrongAttemptsBlockVerification(){row.put("attempts",5);assertThrows(EmailOtpService.OtpDeniedException.class,()->service.verify(new EmailOtpService.VerifyRequest(id,"123456"),"WEB","ip"));}
 @Test void mobileCannotUseWebChallenge(){assertThrows(EmailOtpService.OtpDeniedException.class,()->service.verify(new EmailOtpService.VerifyRequest(id,"123456"),"MOBILE","ip"));verify(users,never()).saveAndFlush(any());}
 @Test void resendPreservesOriginalExpiry(){var result=service.resend(new EmailOtpService.ChallengeRequest(id),"WEB","ip");assertEquals(((Timestamp)row.get("expires_at")).toInstant(),result.expiresAt());verify(users,never()).saveAndFlush(any());verify(mail).sendSignup(eq("customer@example.test"),matches("[0-9]{6}"));}
 @Test void resendCooldownIsEnforced(){row.put("resend_at",Timestamp.from(Instant.now().plusSeconds(60)));assertThrows(OtpRateLimiter.RateLimitedException.class,()->service.resend(new EmailOtpService.ChallengeRequest(id),"WEB","ip"));verifyNoInteractions(mail);}
 @Test void existingEmailCannotRegister(){when(users.existsByEmail(anyString())).thenReturn(true);assertEquals(409,assertThrows(ResponseStatusException.class,()->service.start(new AuthService.RegisterRequest("Customer","customer@example.test","password123"),"WEB","ip")).getStatusCode().value());verify(users,never()).saveAndFlush(any());}
}
