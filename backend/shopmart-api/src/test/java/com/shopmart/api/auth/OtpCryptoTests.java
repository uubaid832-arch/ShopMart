package com.shopmart.api.auth;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OtpCryptoTests {
  private final OtpCrypto crypto = new OtpCrypto("test-only-key-with-at-least-32-bytes");

  @Test
  void rejectsShortServerSecrets() {
    assertThrows(IllegalArgumentException.class, () -> new OtpCrypto("short"));
  }

  @Test
  void codesAreExactlySixAsciiDigitsIncludingLeadingZeros() {
    for (int i = 0; i < 1000; i++)
      assertTrue(crypto.code().matches("[0-9]{6}"));
  }

  @Test
  void digestIsBoundToChallengePurposeAndCode() {
    UUID id = UUID.randomUUID();
    String expected = crypto.codeDigest(id, "LOGIN_WEB", "012345");
    assertTrue(crypto.matches(expected, crypto.codeDigest(id, "LOGIN_WEB", "012345")));
    assertFalse(crypto.matches(expected, crypto.codeDigest(id, "RESET", "012345")));
    assertFalse(crypto.matches(expected, crypto.codeDigest(UUID.randomUUID(), "LOGIN_WEB", "012345")));
    assertFalse(crypto.matches(expected, crypto.codeDigest(id, "LOGIN_WEB", "012346")));
    assertFalse(expected.contains("012345"));
  }
}