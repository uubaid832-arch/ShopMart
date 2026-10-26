package com.shopmart.api.payments;
import java.math.BigDecimal;
import java.util.*;
import com.shopmart.api.orders.OrderModels.*;
import com.shopmart.api.orders.OrderService;
import com.shopmart.api.vouchers.VoucherService;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class SafepayServiceTests {
 JdbcTemplate jdbc;SafepayClient client;OrderService orders;SafepayService service;Map<String,Object> row;
 UUID user=UUID.randomUUID(),id=UUID.randomUUID(),orderId=UUID.randomUUID();
 CreateOrderRequest request;OrderReceipt receipt;
 @BeforeEach void setup(){
  jdbc=mock(JdbcTemplate.class);client=mock(SafepayClient.class);orders=mock(OrderService.class);
  var manager=mock(PlatformTransactionManager.class);when(manager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
  service=new SafepayService(jdbc,client,orders,mock(VoucherService.class),manager);
  request=new CreateOrderRequest(id,"Customer","customer@example.invalid","03001234567","Address","Lahore","DEMO",List.of(new ItemRequest(UUID.randomUUID(),1)),null,new BigDecimal("100.00"));
  receipt=new OrderReceipt(orderId,"SM-TEST","PENDING","DEMO","DEMO_PAID","100.00","PKR",java.time.Instant.now(),List.of(),null);
  row=new HashMap<>(Map.of("id",id,"user_id",user,"state","PENDING","tracker","track_test","merchant_key","test-merchant","amount_minor",10000L,"checkout_url","https://sandbox.api.getsafepay.com/embedded/","order_payload",JsonMapper.builder().build().writeValueAsString(request)));
  when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(user))).thenReturn(true);
  when(jdbc.queryForList(contains("FOR UPDATE"),eq(id))).thenReturn(List.of(row));
  when(client.state("track_test","test-merchant",10000)).thenReturn("TRACKER_STARTED");
  when(orders.getOrder(user,orderId)).thenReturn(receipt);
 }
 @Test void pendingPaymentCannotCreateAnOrder(){assertEquals("PENDING",service.verify(user,id).state());verifyNoInteractions(orders);}
 @Test void successfulProviderVerificationCreatesOnlyDemoAccountingOrder(){when(client.state(anyString(),anyString(),anyLong())).thenReturn("TRACKER_ENDED");when(orders.createSafepayVerified(eq(user),any())).thenReturn(receipt);var result=service.verify(user,id);assertEquals("PAID",result.state());assertEquals("DEMO_PAID",result.order().paymentStatus());verify(orders).createSafepayVerified(eq(user),argThat(r->r.expectedTotal().compareTo(new BigDecimal("100.00"))==0));}
 @Test void alreadyPaidRetryDoesNotCallProviderOrCreateAnotherOrder(){row.put("state","PAID");row.put("order_id",orderId);assertEquals("PAID",service.verify(user,id).state());verify(client,never()).state(anyString(),anyString(),anyLong());verify(orders,never()).createSafepayVerified(any(),any());}
 @Test void mismatchedOwnerCannotReadOrSettlePayment(){row.put("user_id",UUID.randomUUID());assertEquals(404,assertThrows(ResponseStatusException.class,()->service.verify(user,id)).getStatusCode().value());verify(client,never()).state(anyString(),anyString(),anyLong());verifyNoInteractions(orders);}
 @Test void fulfillmentConflictKeepsVerifiedPaymentForReview(){when(client.state(anyString(),anyString(),anyLong())).thenReturn("TRACKER_ENDED");when(orders.createSafepayVerified(any(),any())).thenThrow(new ResponseStatusException(HttpStatus.CONFLICT,"Stock changed"));var result=service.verify(user,id);assertEquals("REVIEW",result.state());assertNull(result.order());verify(jdbc).update(contains("INSERT INTO public.notifications"),anyString(),anyString());}
 @Test void providerCancellationDoesNotCreateAnOrder(){when(client.state(anyString(),anyString(),anyLong())).thenReturn("TRACKER_CANCELLED");assertEquals("CANCELLED",service.verify(user,id).state());verifyNoInteractions(orders);}
 @Test void providerErrorCannotMarkPaymentPaid(){when(client.state(anyString(),anyString(),anyLong())).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE));assertThrows(ResponseStatusException.class,()->service.verify(user,id));verifyNoInteractions(orders);verify(jdbc,never()).update(contains("SET state="),any(Object[].class));}
}
