package com.shopmart.api.mail;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.mail.autoconfigure.MailSenderAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.test.web.client.MockRestServiceServer;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class BrevoMailConfigTests {
  private MockRestServiceServer server;
  private BrevoMailConfig.BrevoMailSender sender;

  @BeforeEach
  void setup() {
    var builder = BrevoMailConfig.clientBuilder("test-key-not-a-real-secret");
    server = MockRestServiceServer.bindTo(builder).build();
    sender = new BrevoMailConfig.BrevoMailSender(builder.build(), "verified@gmail.com", "ShopMart");
  }

  SimpleMailMessage message() {
    var message = new SimpleMailMessage();
    message.setTo("customer@gmail.com");
    message.setSubject("ShopMart verification code");
    message.setText("Your code is 012345.");
    return message;
  }

  @Test
  void sendsOtpThroughHttpsWithCorrectAuthenticationAndPayload() {
    server.expect(requestTo("https://api.brevo.com/v3/smtp/email"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header("api-key", "test-key-not-a-real-secret"))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(content().json("""
            {"sender":{"email":"verified@gmail.com","name":"ShopMart"},
             "to":[{"email":"customer@gmail.com"}],
             "subject":"ShopMart verification code", "textContent":"Your code is 012345."}
            """))
        .andRespond(withStatus(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON)
            .body("{\"messageId\":\"accepted-test-message\"}"));
    sender.send(message());
    server.verify();
  }

  @Test
  void rejectedApiKeyBecomesMailExceptionWithoutExposingTheKey() {
    server.expect(requestTo("https://api.brevo.com/v3/smtp/email"))
        .andRespond(withStatus(HttpStatus.UNAUTHORIZED));
    var error = assertThrows(MailSendException.class, () -> sender.send(message()));
    assertTrue(error.getMessage().contains("401"));
    assertFalse(error.getMessage().contains("test-key-not-a-real-secret"));
    server.verify();
  }

  @Test
  void rateLimitRemainsMailExceptionSoTheActivityQueueCanRetry() {
    server.expect(requestTo("https://api.brevo.com/v3/smtp/email"))
        .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
    assertThrows(MailSendException.class, () -> sender.send(message()));
    server.verify();
  }

  @Test
  void missingRecipientIsRejectedBeforeNetworkCall() {
    var message = message();
    message.setTo(new String[0]);
    assertThrows(MailSendException.class, () -> sender.send(message));
    server.verify();
  }

  @Test
  void subjectLineBreaksAreRemoved() {
    var message = message();
    message.setSubject("Order update\r\nNext line");
    server.expect(requestTo("https://api.brevo.com/v3/smtp/email"))
        .andExpect(jsonPath("$.subject").value("Order update  Next line"))
        .andRespond(withStatus(HttpStatus.CREATED));
    sender.send(message);
    server.verify();
  }

  @Test
  void mimeMessagesCannotFallBackToSmtp() {
    assertThrows(MailSendException.class, () -> sender.send(sender.createMimeMessage()));
    server.verify();
  }

  @Test
  void blankApiKeyFailsAtConfigurationTime() {
    assertThrows(IllegalArgumentException.class,
        () -> new BrevoMailConfig().brevoMailSender("", "verified@gmail.com", "ShopMart"));
  }

  @Test
  void brevoModeReplacesTheSmtpAutoConfiguredBean() {
    new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
        .withUserConfiguration(BrevoMailConfig.class)
        .withPropertyValues(
            "shopmart.mail.provider=brevo",
            "shopmart.brevo.api-key=test-only-key",
            "spring.mail.host=smtp.gmail.com",
            "spring.mail.username=verified@gmail.com")
        .run(context -> {
          assertNull(context.getStartupFailure());
          assertEquals(1, context.getBeansOfType(JavaMailSender.class).size());
          assertInstanceOf(
              BrevoMailConfig.BrevoMailSender.class,
              context.getBean(JavaMailSender.class));
        });
  }

  @Test
  void smtpModePreservesTheExistingSmtpBean() {
    new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class))
        .withUserConfiguration(BrevoMailConfig.class)
        .withPropertyValues(
            "shopmart.mail.provider=smtp",
            "spring.mail.host=smtp.gmail.com",
            "spring.mail.username=verified@gmail.com")
        .run(context -> {
          assertNull(context.getStartupFailure());
          assertEquals(1, context.getBeansOfType(JavaMailSender.class).size());
          assertEquals(
              JavaMailSenderImpl.class,
              context.getBean(JavaMailSender.class).getClass());
        });
  }
}