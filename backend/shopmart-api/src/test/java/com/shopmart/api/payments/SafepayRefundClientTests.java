package com.shopmart.api.payments;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class SafepayRefundClientTests {
  MockRestServiceServer server;
  SafepayRefundClient client;

  @BeforeEach void setup() {
    var builder = SafepayClient.builder("");
    server = MockRestServiceServer.bindTo(builder).build();
    client = new SafepayRefundClient("sandbox-merchant-secret", builder);
  }

  String response(String state) {
    return """
      {"status":{"message":"success","errors":[]},"data":{"tracker":{
      "token":"track_test12345","client":"merchant","environment":"sandbox","state":"%s",
      "purchase_totals":{"quote_amount":{"currency":"PKR","amount":10000}}}}}
      """.formatted(state);
  }

  void expectToken() {
    server.expect(requestTo(SafepayClient.HOST + "/client/passport/v1/token"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header("X-SFPY-MERCHANT-SECRET", "sandbox-merchant-secret"))
        .andRespond(withSuccess("{\"data\":\"short-lived-sandbox-token\"}", MediaType.APPLICATION_JSON));
  }

  @Test void obtainsTokenBeforeRefundAndNeverSendsMerchantSecretToRefundEndpoint() {
    expectToken();
    server.expect(requestTo(SafepayClient.HOST + "/order/payments/v3/track_test12345/refund"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer short-lived-sandbox-token"))
        .andExpect(request -> assertFalse(request.getHeaders().containsKey("X-SFPY-MERCHANT-SECRET")))
        .andExpect(content().json("{\"currency\":\"PKR\",\"amount\":4000}"))
        .andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND"), MediaType.APPLICATION_JSON));
    assertEquals("TRACKER_PARTIAL_REFUND", client.refund("track_test12345","merchant",10000,4000,false));
    server.verify();
  }

  @Test void fullRefundRequiresFullState() {
    expectToken();
    server.expect(anything()).andRespond(withSuccess(response("TRACKER_REFUNDED"),MediaType.APPLICATION_JSON));
    assertEquals("TRACKER_REFUNDED",client.refund("track_test12345","merchant",10000,10000,true));
    server.verify();
  }

  @Test void httpSuccessAloneIsNotConfirmation() {
    expectToken();
    server.expect(anything()).andRespond(withSuccess(response("TRACKER_ENDED"),MediaType.APPLICATION_JSON));
    assertThrows(IllegalStateException.class,()->client.refund("track_test12345","merchant",10000,4000,false));
    server.verify();
  }

  @Test void wrongMerchantRejected() {
    expectToken();
    server.expect(anything()).andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND"),MediaType.APPLICATION_JSON));
    assertThrows(IllegalStateException.class,()->client.refund("track_test12345","another",10000,4000,false));
    server.verify();
  }

  @Test void productionResponseRejected() {
    expectToken();
    server.expect(anything()).andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND").replace("sandbox","production"),MediaType.APPLICATION_JSON));
    assertThrows(IllegalStateException.class,()->client.refund("track_test12345","merchant",10000,4000,false));
    server.verify();
  }

  @Test void providerErrorBodyRejected() {
    expectToken();
    server.expect(anything()).andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND").replace("\"errors\":[]","\"errors\":[\"declined\"]"),MediaType.APPLICATION_JSON));
    assertThrows(IllegalStateException.class,()->client.refund("track_test12345","merchant",10000,4000,false));
    server.verify();
  }

  @Test void missingSecretFailsBeforeAnyNetworkRequest() {
    var emptyClient = new SafepayRefundClient("", SafepayClient.builder(""));
    assertThrows(org.springframework.web.server.ResponseStatusException.class, emptyClient::requireConfigured);
  }

  @Test void blankTokenStopsBeforeRefundRequest() {
    server.expect(requestTo(SafepayClient.HOST + "/client/passport/v1/token"))
        .andRespond(withSuccess("{\"data\":\"\"}",MediaType.APPLICATION_JSON));
    assertThrows(IllegalStateException.class,()->client.refund("track_test12345","merchant",10000,4000,false));
    server.verify(); // The only request was authentication, not a refund.
  }

  @Test void unauthorizedTokenRequestStopsBeforeRefundRequest() {
    server.expect(requestTo(SafepayClient.HOST + "/client/passport/v1/token"))
        .andRespond(withStatus(HttpStatus.UNAUTHORIZED));
    assertThrows(RuntimeException.class,()->client.refund("track_test12345","merchant",10000,4000,false));
    server.verify();
  }
}
