package com.shopmart.api.notifications;

import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ActivityEmailWorkerTests {
  JdbcTemplate jdbc;
  JavaMailSender mail;
  ActivityEmailWorker worker;
  UUID id;

  @BeforeEach void setup() {
    jdbc = mock(JdbcTemplate.class);
    mail = mock(JavaMailSender.class);
    PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    when(manager.getTransaction(any())).thenAnswer(call -> new SimpleTransactionStatus());
    worker = new ActivityEmailWorker(jdbc, mail, manager, "sender@gmail.com");
    id = UUID.randomUUID();
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  void queue(boolean enabled, int attempts) throws Exception {
    ResultSet rs = mock(ResultSet.class);
    when(rs.getObject("notification_id", UUID.class)).thenReturn(id);
    when(rs.getInt("attempts")).thenReturn(attempts);
    when(rs.getString("email")).thenReturn("recipient@gmail.com");
    when(rs.getBoolean("enabled")).thenReturn(enabled);
    when(rs.getString("title")).thenReturn("Out for delivery");
    when(rs.getString("message")).thenReturn("Your order is out for delivery.");
    doAnswer(call -> {
      RowMapper<?> mapper = call.getArgument(1);
      return List.of(mapper.mapRow(rs, 0));
    }).doReturn(List.of()).when(jdbc).query(anyString(), any(RowMapper.class));
  }

  @Test void sendsExistingNotificationContentToItsRecipient() throws Exception {
    queue(true, 0);
    worker.sendPending();
    ArgumentCaptor<SimpleMailMessage> captured = ArgumentCaptor.forClass(SimpleMailMessage.class);
    verify(mail).send(captured.capture());
    assertArrayEquals(new String[]{"recipient@gmail.com"}, captured.getValue().getTo());
    assertEquals("ShopMart - Out for delivery", captured.getValue().getSubject());
    assertTrue(captured.getValue().getText().contains("Your order is out for delivery."));
    verify(jdbc).update(contains("state = 'SENT'"), eq(id));
  }

  @Test void deliveryFailureIsQueuedForRetryWithoutThrowing() throws Exception {
    queue(true, 0);
    doThrow(new MailSendException("test failure")).when(mail).send(any(SimpleMailMessage.class));
    assertDoesNotThrow(worker::sendPending);
    verify(jdbc).update(contains("next_attempt_at ="), eq("PENDING"), eq(1), eq(30L), eq(id));
  }

  @Test void fifthFailureStopsAutomaticRetries() throws Exception {
    queue(true, 4);
    doThrow(new MailSendException("test failure")).when(mail).send(any(SimpleMailMessage.class));
    worker.sendPending();
    verify(jdbc).update(contains("next_attempt_at ="), eq("FAILED"), eq(5), eq(480L), eq(id));
  }

  @Test void disabledAccountDoesNotReceiveEmail() throws Exception {
    queue(false, 0);
    worker.sendPending();
    verify(mail, never()).send(any(SimpleMailMessage.class));
    verify(jdbc).update(contains("state = 'SKIPPED'"), eq(id));
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  @Test void emptyQueueDoesNotSendAnything() {
    when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
    worker.sendPending();
    verify(mail, never()).send(any(SimpleMailMessage.class));
  }
}
