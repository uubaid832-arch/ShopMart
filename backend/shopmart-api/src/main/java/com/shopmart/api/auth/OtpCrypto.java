package com.shopmart.api.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OtpCrypto {
  private final byte[] secret;
  private final SecureRandom random = new SecureRandom();

  public OtpCrypto(@Value("${shopmart.otp.secret}") String secret) {
    this.secret = secret.getBytes(StandardCharsets.UTF_8);
    if (this.secret.length < 32) {
      throw new IllegalArgumentException("SHOPMART_OTP_SECRET must contain at least 32 bytes.");
    }
  }

  public String code() {
    return String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
  }

  public String digest(String value) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.GeneralSecurityException failure) {
      throw new IllegalStateException("OTP cryptography is unavailable.", failure);
    }
  }

  public String codeDigest(UUID id, String purpose, String code) {
    return digest("code:" + id + ":" + purpose + ":" + code);
  }

  public boolean matches(String expected, String actual) {
    return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
        actual.getBytes(StandardCharsets.US_ASCII));
  }
}
