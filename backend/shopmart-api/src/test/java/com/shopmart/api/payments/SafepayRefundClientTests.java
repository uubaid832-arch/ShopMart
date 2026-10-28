package com.shopmart.api.payments;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class SafepayRefundClientTests {
  MockRestServiceServer server; SafepayRefundClient client;
  @BeforeEach void setup(){var builder=SafepayClient.builder("");server=MockRestServiceServer.bindTo(builder).build();client=new SafepayRefundClient("sandbox-server-key",builder);}
  String response(String state){return """
    {"status":{"message":"success","errors":[]},"data":{"tracker":{
    "token":"track_test12345","client":"merchant","environment":"sandbox","state":"%s",
    "purchase_totals":{"quote_amount":{"currency":"PKR","amount":10000}}}}}
    """.formatted(state);}
  @Test void usesDocumentedRouteBearerAndMinorUnits(){
    server.expect(requestTo(SafepayClient.HOST+"/order/payments/v3/track_test12345/refund"))
      .andExpect(method(HttpMethod.POST)).andExpect(header("Authorization","Bearer sandbox-server-key"))
      .andExpect(content().json("{\"currency\":\"PKR\",\"amount\":4000}"))
      .andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND"),MediaType.APPLICATION_JSON));
    assertEquals("TRACKER_PARTIAL_REFUND",client.refund("track_test12345","merchant",10000,4000,false));server.verify();
  }
  @Test void fullRefundRequiresFullState(){server.expect(anything()).andRespond(withSuccess(response("TRACKER_REFUNDED"),MediaType.APPLICATION_JSON));assertEquals("TRACKER_REFUNDED",client.refund("track_test12345","merchant",10000,10000,true));}
  @Test void httpSuccessAloneIsNotConfirmation(){server.expect(anything()).andRespond(withSuccess(response("TRACKER_ENDED"),MediaType.APPLICATION_JSON));assertThrows(IllegalStateException.class,()->client.refund("track_test12345","merchant",10000,4000,false));}
  @Test void wrongMerchantRejected(){server.expect(anything()).andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND"),MediaType.APPLICATION_JSON));assertThrows(IllegalStateException.class,()->client.refund("track_test12345","another",10000,4000,false));}
  @Test void productionResponseRejected(){server.expect(anything()).andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND").replace("sandbox","production"),MediaType.APPLICATION_JSON));assertThrows(IllegalStateException.class,()->client.refund("track_test12345","merchant",10000,4000,false));}
  @Test void providerErrorBodyRejected(){server.expect(anything()).andRespond(withSuccess(response("TRACKER_PARTIAL_REFUND").replace("\"errors\":[]","\"errors\":[\"declined\"]"),MediaType.APPLICATION_JSON));assertThrows(IllegalStateException.class,()->client.refund("track_test12345","merchant",10000,4000,false));}
}
