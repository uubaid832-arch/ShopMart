package com.shopmart.api.notifications;

import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@EnableScheduling
@ConditionalOnProperty(name = "shopmart.activity-mail.enabled", havingValue = "true", matchIfMissing = true)
public class ActivityEmailWorker {
  private static final Logger log = LoggerFactory.getLogger(ActivityEmailWorker.class);
  private final JdbcTemplate jdbc;
  private final JavaMailSender mail;
  private final String from;
  private final TransactionTemplate transactions;

  public ActivityEmailWorker(JdbcTemplate jdbc, JavaMailSender mail,
      PlatformTransactionManager manager, @Value("${spring.mail.username}") String from) {
    this.jdbc = jdbc;
    this.mail = mail;
    this.from = from;
    this.transactions = new TransactionTemplate(manager);
  }

  // Each message uses its own short transaction. Mail failures never roll back an order.
  // SKIP LOCKED allows multiple backend instances to share the durable queue.
  @Scheduled(fixedDelayString = "${shopmart.activity-mail.poll-ms:10000}", initialDelay = 3000)
  public void sendPending() {
    for (int i = 0; i < 5; i++) {
      try {
        Boolean found = transactions.execute(status -> sendOne());
        if (!Boolean.TRUE.equals(found)) return;
      } catch (RuntimeException failure) {
        // Avoid logging SMTP credentials, addresses, order content or tokens.
        log.warn("Activity email queue could not be processed; it will be retried.");
        return;
      }
    }
  }

  private boolean sendOne() {
    List<QueuedMail> pending = jdbc.query("""
        SELECT q.notification_id, q.attempts, u.email, u.enabled, n.title, n.message
        FROM public.activity_email_outbox q
        JOIN public.notifications n ON n.id = q.notification_id
        JOIN public.users u ON u.id = n.user_id
        WHERE q.state = 'PENDING' AND q.next_attempt_at <= clock_timestamp()
        ORDER BY q.next_attempt_at, q.notification_id
        LIMIT 1 FOR UPDATE OF q SKIP LOCKED
        """, (rs, row) -> new QueuedMail(rs.getObject("notification_id", UUID.class),
        rs.getInt("attempts"), rs.getString("email"), rs.getBoolean("enabled"),
        rs.getString("title"), rs.getString("message")));
    if (pending.isEmpty()) return false;
    QueuedMail item = pending.get(0);
    if (!item.enabled()) {
      jdbc.update("UPDATE public.activity_email_outbox SET state = 'SKIPPED', last_error = 'Account disabled' WHERE notification_id = ?", item.id());
      return true;
    }

    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(from);
    message.setTo(item.email());
    message.setSubject("ShopMart - " + item.title().replace('\r', ' ').replace('\n', ' '));
    message.setText("Hello,\n\n" + item.message()
        + "\n\nOpen ShopMart to view the latest details.\n\nShopMart\nThis is an automated activity notification.");
    try {
      mail.send(message);
      jdbc.update("""
          UPDATE public.activity_email_outbox
          SET state = 'SENT', attempts = attempts + 1, sent_at = clock_timestamp(), last_error = NULL
          WHERE notification_id = ?
          """, item.id());
    } catch (MailException failure) {
      int attempts = item.attempts() + 1;
      long delaySeconds = Math.min(900L, 30L * (1L << (attempts - 1)));
      jdbc.update("""
          UPDATE public.activity_email_outbox
          SET state = ?, attempts = ?, last_error = 'SMTP delivery failed',
              next_attempt_at = clock_timestamp() + (? * interval '1 second')
          WHERE notification_id = ?
          """, attempts >= 5 ? "FAILED" : "PENDING", attempts, delaySeconds, item.id());
    }
    return true;
  }

  private record QueuedMail(UUID id, int attempts, String email, boolean enabled, String title, String message) {
    @Override public String toString() { return "QueuedMail[REDACTED]"; }
  }
}
