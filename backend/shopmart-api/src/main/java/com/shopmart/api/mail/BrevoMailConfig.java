package com.shopmart.api.mail;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessagePreparator;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "shopmart.mail.provider", havingValue = "brevo")
public class BrevoMailConfig {
  @Bean
  public JavaMailSender brevoMailSender(
      @Value("${shopmart.brevo.api-key}") String apiKey,
      @Value("${spring.mail.username}") String senderEmail,
      @Value("${shopmart.mail.sender-name:ShopMart}") String senderName) {
    if (apiKey.isBlank() || senderEmail.isBlank()) {
      throw new IllegalArgumentException("Brevo requires SHOPMART_BREVO_API_KEY and SHOPMART_MAIL_USERNAME.");
    }
    return new BrevoMailSender(clientBuilder(apiKey.strip()).build(), senderEmail.strip(), senderName);
  }

  static RestClient.Builder clientBuilder(String apiKey) {
    HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
    factory.setReadTimeout(Duration.ofSeconds(10));
    return RestClient.builder().baseUrl("https://api.brevo.com/v3")
        .requestFactory(factory)
        .defaultHeader("api-key", apiKey)
        .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE);
  }

  // Existing OTP and activity services inject JavaMailSender. In Brevo mode this
  // implementation sends their plain-text messages over HTTPS instead of SMTP.
  static final class BrevoMailSender extends JavaMailSenderImpl {
    private static final Logger log = LoggerFactory.getLogger(BrevoMailSender.class);
    private final RestClient client;
    private final String sender;
    private final String senderName;

    BrevoMailSender(RestClient client, String sender, String senderName) {
      this.client = client;
      this.sender = sender;
      this.senderName = senderName;
    }

    @Override
    public void send(SimpleMailMessage message) {
      send(new SimpleMailMessage[]{message});
    }

    @Override
    public void send(SimpleMailMessage... messages) {
      if (messages == null) throw new MailSendException("No email message supplied.");
      for (SimpleMailMessage message : messages) {
        if (message == null || message.getTo() == null || message.getTo().length == 0) {
          throw new MailSendException("An email recipient is required.");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sender", Map.of("email", sender, "name", senderName));
        body.put("to", recipients(message.getTo()));
        body.put("subject", cleanSubject(message.getSubject()));
        body.put("textContent", message.getText() == null ? "" : message.getText());
        if (message.getCc() != null && message.getCc().length > 0) body.put("cc", recipients(message.getCc()));
        if (message.getBcc() != null && message.getBcc().length > 0) body.put("bcc", recipients(message.getBcc()));
        if (message.getReplyTo() != null) body.put("replyTo", Map.of("email", message.getReplyTo()));
        try {
          client.post().uri("/smtp/email").contentType(MediaType.APPLICATION_JSON)
              .body(body).retrieve().toBodilessEntity();
        } catch (RestClientResponseException failure) {
          // Log only the HTTP status. API keys, OTPs, recipient details and response bodies stay private.
          int status = failure.getStatusCode().value();
          log.warn("Brevo rejected an email request with HTTP {}.", status);
          throw new MailSendException("Brevo email request failed (HTTP " + status + ").");
        } catch (RestClientException failure) {
          log.warn("Brevo email request could not be completed.");
          throw new MailSendException("Brevo email delivery is temporarily unavailable.");
        }
      }
    }

    private static List<Map<String, String>> recipients(String[] addresses) {
      return Arrays.stream(addresses).map(address -> Map.of("email", address)).toList();
    }

    private static String cleanSubject(String subject) {
      return subject == null ? "ShopMart" : subject.replace('\r', ' ').replace('\n', ' ');
    }

    // ShopMart currently uses plain-text messages only. Reject unsupported MIME
    // sends explicitly so no caller can silently fall back to blocked SMTP ports.
    @Override public void send(MimeMessage message) { throw unsupportedMime(); }
    @Override public void send(MimeMessage... messages) { throw unsupportedMime(); }
    @Override public void send(MimeMessagePreparator preparator) { throw unsupportedMime(); }
    @Override public void send(MimeMessagePreparator... preparators) { throw unsupportedMime(); }
    private static MailSendException unsupportedMime() {
      return new MailSendException("Brevo integration supports ShopMart plain-text messages only.");
    }
  }
}
