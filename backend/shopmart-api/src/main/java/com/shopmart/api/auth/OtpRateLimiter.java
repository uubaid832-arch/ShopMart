package com.shopmart.api.auth;

import java.time.Duration;
import java.sql.Timestamp;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@EnableScheduling
public class OtpRateLimiter {
  private final JdbcTemplate jdbc;
  private final OtpCrypto crypto;

  public OtpRateLimiter(JdbcTemplate jdbc, OtpCrypto crypto) {
    this.jdbc = jdbc;
    this.crypto = crypto;
  }

  // Separate transactions preserve counters when authentication or email delivery fails.
  @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = RateLimitedException.class)
  public void take(String bucket, int limit, Duration duration) {
    Integer hits = jdbc.queryForObject("""
        INSERT INTO public.auth_rate_limits(bucket_key, hits, window_end)
        VALUES (?, 1, clock_timestamp() + (? * interval '1 second'))
        ON CONFLICT (bucket_key) DO UPDATE SET
          hits = CASE WHEN auth_rate_limits.window_end <= clock_timestamp()
            THEN 1 ELSE auth_rate_limits.hits + 1 END,
          window_end = CASE WHEN auth_rate_limits.window_end <= clock_timestamp()
            THEN clock_timestamp() + (? * interval '1 second')
            ELSE auth_rate_limits.window_end END
        RETURNING hits
        """, Integer.class, crypto.digest("rate:" + bucket), duration.toSeconds(), duration.toSeconds());
    // Do not throw inside this transaction: committing excess hits is intentional.
    if (hits != null && hits > limit) {
      throw new RateLimitedException();
    }
  }

  @Scheduled(fixedDelay = 3_600_000, initialDelay = 3_600_000)
  public void cleanup() {
    Timestamp cutoff = Timestamp.from(java.time.Instant.now().minus(Duration.ofDays(1)));
    jdbc.update("DELETE FROM public.email_otp_challenges WHERE expires_at < ?", cutoff);
    jdbc.update("DELETE FROM public.auth_rate_limits WHERE window_end < ?", cutoff);
  }

  public static class RateLimitedException extends ResponseStatusException {
    public RateLimitedException() {
      super(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Please wait before trying again.");
    }
  }
}
