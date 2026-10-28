package com.shopmart.api.payments;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

/** Contract: official modify-payments/refund cURL tab. Sandbox host is fixed. */
@Component
public class SafepayRefundClient {
  private final RestClient http;
  private final String serverKey;
  @org.springframework.beans.factory.annotation.Autowired
  public SafepayRefundClient(@Value("${SHOPMART_SAFEPAY_REFUND_SERVER_KEY:}") String key) {
    this(key, SafepayClient.builder(""));
  }
  SafepayRefundClient(String key, RestClient.Builder builder) {
    serverKey = key.strip();
    http = builder.defaultHeaders(headers -> headers.remove("X-SFPY-MERCHANT-SECRET")).defaultHeader("Authorization", "Bearer " + serverKey).build();
  }
  public void requireConfigured() {
    if (serverKey.isBlank()) throw new org.springframework.web.server.ResponseStatusException(
        org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Configure the Safepay sandbox refund server key first.");
  }
  public String refund(String tracker, String merchant, long captured, long amount, boolean full) {
    requireConfigured();
    JsonNode response = http.post().uri("/order/payments/v3/{tracker}/refund", tracker)
        .body(Map.of("currency", "PKR", "amount", amount)).retrieve().body(JsonNode.class);
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
        || !state.equals(payment.path("state").asText())) throw new IllegalStateException("Unconfirmed refund");
    return state;
  }
}
