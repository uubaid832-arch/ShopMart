package com.shopmart.api.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OtpMailService {
  private final JavaMailSender sender;
  private final String from;

  public OtpMailService(JavaMailSender sender,
      @Value("${spring.mail.username}") String from) {
    this.sender = sender;
    this.from = from;
  }

  public void send(String email, String code, boolean reset) {
    sendCode(email, code, reset ? "password reset" : "sign-in");
  }
  public void sendSignup(String email, String code) { sendCode(email, code, "account creation"); }
  private void sendCode(String email, String code, String purpose) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(from);
    message.setTo(email);
    message.setSubject("ShopMart " + purpose + " verification code");
    message.setText("Your ShopMart " + purpose + " code is:\n\n"
        + code + "\n\nThis code expires in 5 minutes and can be used only once."
        + "\nDo not share it with anyone. If you did not request it, ignore this email.");
    try {
      sender.send(message);
    } catch (MailException failure) {
      // Never log the message, OTP, recipient or SMTP credentials.
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "Verification email could not be sent. Please try again later.");
    }
  }
}
