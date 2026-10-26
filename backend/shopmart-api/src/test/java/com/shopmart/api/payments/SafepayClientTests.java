package com.shopmart.api.payments;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class SafepayClientTests {
 MockRestServiceServer server;SafepayClient client;
 @BeforeEach void setup(){var builder=SafepayClient.builder("test-secret");server=MockRestServiceServer.bindTo(builder).build();client=new SafepayClient(true,"test-merchant","test-secret","https://shopmart.example.invalid",builder);}
 String tracker="track_12345678-test";
 String report(String state,String owner,String environment,long amount,boolean nested){
  String data="{\"token\":\""+tracker+"\",\"environment\":\""+environment+"\",\"client\":{\"api_key\":\""+owner+"\"},\"state\":\""+state+"\",\"purchase_totals\":{\"quote_amount\":{\"currency\":\"PKR\",\"amount\":"+amount+"}}}";
  return "{\"data\":"+(nested?"{\"tracker\":"+data+"}":data)+"}";
 }
 @Test void createsHostedCheckoutWithoutExposingSecret(){
  server.expect(requestTo(SafepayClient.HOST+"/order/payments/v3/")).andExpect(method(HttpMethod.POST)).andExpect(header("X-SFPY-MERCHANT-SECRET","test-secret"))
   .andExpect(content().json("{\"merchant_api_key\":\"test-merchant\",\"amount\":12345,\"currency\":\"PKR\",\"mode\":\"payment\",\"intent\":\"CYBERSOURCE\",\"entry_mode\":\"raw\",\"include_fees\":false}"))
   .andRespond(withSuccess("{\"data\":{\"tracker\":{\"token\":\""+tracker+"\"}}}",MediaType.APPLICATION_JSON));
  server.expect(requestTo(SafepayClient.HOST+"/client/passport/v1/token")).andExpect(method(HttpMethod.POST)).andRespond(withSuccess("{\"data\":\"short+token/==\"}",MediaType.APPLICATION_JSON));
  var result=client.create(UUID.randomUUID(),12345,"mobile");assertEquals(tracker,result.tracker());assertTrue(result.url().startsWith(SafepayClient.HOST+"/embedded/?"));assertTrue(result.url().contains("source=mobile"));assertTrue(result.url().contains("short%2Btoken%2F%3D%3D"));assertFalse(result.url().contains("test-secret"));server.verify();
 }
 @Test void verifiesReporterInBothDocumentedShapes(){for(boolean nested:new boolean[]{false,true}){setup();server.expect(requestTo(SafepayClient.HOST+"/reporter/api/v1/payments/"+tracker)).andRespond(withSuccess(report("TRACKER_ENDED","test-merchant","sandbox",12345,nested),MediaType.APPLICATION_JSON));assertEquals("TRACKER_ENDED",client.state(tracker,"test-merchant",12345));}server.verify();}
 @Test void refusesMismatchedAmount(){server.expect(anything()).andRespond(withSuccess(report("TRACKER_ENDED","test-merchant","sandbox",999,false),MediaType.APPLICATION_JSON));assertThrows(ResponseStatusException.class,()->client.state(tracker,"test-merchant",12345));}
 @Test void refusesAnotherMerchant(){server.expect(anything()).andRespond(withSuccess(report("TRACKER_ENDED","another","sandbox",12345,false),MediaType.APPLICATION_JSON));assertThrows(ResponseStatusException.class,()->client.state(tracker,"test-merchant",12345));}
 @Test void refusesProductionPayment(){server.expect(anything()).andRespond(withSuccess(report("TRACKER_ENDED","test-merchant","production",12345,false),MediaType.APPLICATION_JSON));assertThrows(ResponseStatusException.class,()->client.state(tracker,"test-merchant",12345));}
 @Test void providerErrorsDoNotExposeKeys(){server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED));var error=assertThrows(ResponseStatusException.class,()->client.state(tracker,"test-merchant",12345));assertFalse(error.getMessage().contains("test-secret"));}
 @Test void disabledSandboxCannotStartCheckout(){var disabled=new SafepayClient(false,"","","https://shopmart.example.invalid",SafepayClient.builder(""));assertThrows(ResponseStatusException.class,()->disabled.create(UUID.randomUUID(),100,"web"));}
}
