package com.shopmart.api.auth;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerSignupService {
  private final JdbcTemplate jdbc;
  private final UserAccountRepository users;
  private final PasswordEncoder passwords;
  private final OtpCrypto crypto;
  private final OtpRateLimiter rates;
  private final OtpMailService mail;
  public CustomerSignupService(JdbcTemplate jdbc, UserAccountRepository users, PasswordEncoder passwords,
      OtpCrypto crypto, OtpRateLimiter rates, OtpMailService mail) {
    this.jdbc=jdbc; this.users=users; this.passwords=passwords; this.crypto=crypto; this.rates=rates; this.mail=mail;
  }
  @Transactional
  public EmailOtpService.ChallengeResponse start(AuthService.RegisterRequest request, String channel, String ip) {
    String email=request.email().strip().toLowerCase(Locale.ROOT);
    String name=request.name().strip();
    if(name.isBlank() || request.password().getBytes(StandardCharsets.UTF_8).length>72)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter a name and a password of at most 72 UTF-8 bytes.");
    rates.take("signup-ip:"+ip,20,Duration.ofMinutes(15));
    sendLimits(email);
    if(users.existsByEmail(email)) throw new ResponseStatusException(HttpStatus.CONFLICT,"An account with this email already exists. Sign in instead.");
    UUID id=UUID.randomUUID(); String code=crypto.code(); Instant now=Instant.now();
    jdbc.update("DELETE FROM public.customer_signup_challenges WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'");
    jdbc.update("UPDATE public.customer_signup_challenges SET consumed=TRUE WHERE email=? AND channel=?",email,channel);
    jdbc.update("""
      INSERT INTO public.customer_signup_challenges(id,channel,email,name,password_hash,code_digest,expires_at,resend_at)
      VALUES(?,?,?,?,?,?,?,?)
      """,id,channel,email,name,passwords.encode(request.password()),crypto.codeDigest(id,"SIGNUP_"+channel,code),
      Timestamp.from(now.plusSeconds(300)),Timestamp.from(now.plusSeconds(60)));
    mail.sendSignup(email,code);
    return new EmailOtpService.ChallengeResponse(id,now.plusSeconds(300),now.plusSeconds(60));
  }
  @Transactional(noRollbackFor=EmailOtpService.OtpDeniedException.class)
  public AuthService.UserResponse verify(EmailOtpService.VerifyRequest request,String channel,String ip) {
    rates.take("signup-verify-ip:"+ip,60,Duration.ofMinutes(15));
    var row=locked(request.challengeId(),channel);
    valid(row);
    rates.take("signup-verify-email:"+crypto.digest((String)row.get("email")),20,Duration.ofMinutes(15));
    jdbc.update("UPDATE public.customer_signup_challenges SET attempts=attempts+1 WHERE id=?",request.challengeId());
    if(!crypto.matches((String)row.get("code_digest"),crypto.codeDigest(request.challengeId(),"SIGNUP_"+channel,request.code())))
      throw new EmailOtpService.OtpDeniedException();
    String email=(String)row.get("email");
    if(users.existsByEmail(email)) throw new ResponseStatusException(HttpStatus.CONFLICT,"This account already exists. Sign in instead.");
    UserAccount user=new UserAccount((String)row.get("name"),email,(String)row.get("password_hash"));
    var saved=users.saveAndFlush(user);
    jdbc.update("UPDATE public.customer_signup_challenges SET consumed=TRUE WHERE email=?",email);
    return AuthService.toResponse(saved);
  }
  @Transactional
  public EmailOtpService.ChallengeResponse resend(EmailOtpService.ChallengeRequest request,String channel,String ip) {
    rates.take("signup-resend-ip:"+ip,30,Duration.ofMinutes(15));
    var row=locked(request.challengeId(),channel); valid(row);
    Instant now=Instant.now();
    if(((Timestamp)row.get("resend_at")).toInstant().isAfter(now)) throw new OtpRateLimiter.RateLimitedException();
    String email=(String)row.get("email"); sendLimits(email);
    String code=crypto.code(); Instant resend=now.plusSeconds(60);
    jdbc.update("UPDATE public.customer_signup_challenges SET code_digest=?,resend_at=? WHERE id=?",
      crypto.codeDigest(request.challengeId(),"SIGNUP_"+channel,code),Timestamp.from(resend),request.challengeId());
    mail.sendSignup(email,code);
    return new EmailOtpService.ChallengeResponse(request.challengeId(),((Timestamp)row.get("expires_at")).toInstant(),resend);
  }
  private Map<String,Object> locked(UUID id,String channel) {
    var rows=jdbc.queryForList("SELECT * FROM public.customer_signup_challenges WHERE id=? AND channel=? FOR UPDATE",id,channel);
    if(rows.isEmpty()) throw new EmailOtpService.OtpDeniedException();
    return rows.get(0);
  }
  private void valid(Map<String,Object> row) {
    if(Boolean.TRUE.equals(row.get("consumed")) || ((Number)row.get("attempts")).intValue()>=5
       || !((Timestamp)row.get("expires_at")).toInstant().isAfter(Instant.now())) throw new EmailOtpService.OtpDeniedException();
  }
  private void sendLimits(String email) {
    String key=crypto.digest("email:"+email);
    rates.take("signup-mail-window:"+key,5,Duration.ofMinutes(15));
    rates.take("signup-mail-cooldown:"+key,1,Duration.ofSeconds(60));
  }
}
