package com.shopmart.api.payments;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

/**
 * Sandbox-only refund adapter. Uses the existing Safepay merchant SECRET to
 * request a short-lived bearer token; never exposes the secret to the frontend.
 *
 * A successful bearer token exchange does NOT prove the refund endpoint accepts
 * that token. Do not use for production until verified against Safepay sandbox.
 */
@Component
public class SafepayRefundClient {
  private final RestClient http;
  private final String merchantSecret;

  @org.springframework.beans.factory.annotation.Autowired
  public SafepayRefundClient(@Value("${SHOPMART_SAFEPAY_SECRET_KEY:}") String secret) {
    this(secret, SafepayClient.builder(""));
  }

  SafepayRefundClient(String secret, RestClient.Builder builder) {
    merchantSecret = secret == null ? "" : secret.strip();
    http = builder.defaultHeaders(headers -> {
      headers.remove(HttpHeaders.AUTHORIZATION);
      headers.remove("X-SFPY-MERCHANT-SECRET");
    }).build();
  }

  public void requireConfigured() {
    if (merchantSecret.isBlank()) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "Configure SHOPMART_SAFEPAY_SECRET_KEY for sandbox refunds.");
    }
  }

  /** Obtain one fresh token per refund; no caching/retry across uncertain outcomes. */
  private String getSandboxBearerToken() {
    requireConfigured();
    // Safepay API Reference: POST /client/passport/v1/token, authenticated via
    // X-SFPY-MERCHANT-SECRET, response {"data":"<short-lived token>"}.
    JsonNode response = http.post()
        .uri("/client/passport/v1/token")
        .header("X-SFPY-MERCHANT-SECRET", merchantSecret)
        .body(Map.of())
        .retrieve().body(JsonNode.class);
    if (response == null || !response.path("data").isTextual()
        || response.path("data").asText().isBlank()) {
      throw new IllegalStateException("Safepay sandbox authentication was not confirmed");
    }
    return response.path("data").asText();
  }

  public String refund(String tracker, String merchant, long captured, long amount, boolean full) {
    requireConfigured();
    String bearer = getSandboxBearerToken();
    // Only sandbox: SafepayClient.builder("") uses a fixed sandbox base URL.
    JsonNode response = http.post()
        .uri("/order/payments/v3/{tracker}/refund", tracker)
        .headers(headers -> {
          headers.remove("X-SFPY-MERCHANT-SECRET");
          headers.setBearerAuth(bearer);
        })
        .body(Map.of("currency", "PKR", "amount", amount))
        .retrieve().body(JsonNode.class);

    if (response == null) throw new IllegalStateException("Unconfirmed refund");
    JsonNode status = response.path("status"), payment = response.path("data").path("tracker");
    JsonNode owner = payment.path("client"), total = payment.path("purchase_totals").path("quote_amount");
    String state = full ? "TRACKER_REFUNDED" : "TRACKER_PARTIAL_REFUND";
    if (!"success".equals(status.path("message").asText()) || !status.path("errors").isArray()
        || !status.path("errors").isEmpty() || !tracker.equals(payment.path("token").asText())
        || !"sandbox".equals(payment.path("environment").asText())
        || !merchant.equals(owner.isTextual() ? owner.asText() : owner.path("api_key").asText())
        || !"PKR".equals(total.path("currency").asText())
        || !Long.toString(captured).equals(total.path("amount").asText())
        || !state.equals(payment.path("state").asText())) {
      throw new IllegalStateException("Unconfirmed refund");
    }
    return state;
  }
}
