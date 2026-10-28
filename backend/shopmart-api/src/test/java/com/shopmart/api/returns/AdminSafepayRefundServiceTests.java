package com.shopmart.api.returns;

import java.math.BigDecimal;
import java.util.*;
import com.shopmart.api.payments.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.*;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AdminSafepayRefundServiceTests {
  UUID admin=UUID.randomUUID(), id=UUID.randomUUID(), order=UUID.randomUUID();
  JdbcTemplate jdbc; SafepayClient payments; SafepayRefundClient provider;
  PlatformTransactionManager manager; AdminSafepayRefundService service;
  Map<String,Object> o,r;
  @BeforeEach void setup(){
    jdbc=mock(JdbcTemplate.class); payments=mock(SafepayClient.class); provider=mock(SafepayRefundClient.class);
    manager=mock(PlatformTransactionManager.class);
    when(manager.getTransaction(any())).thenAnswer(i->mock(TransactionStatus.class));
    service=new AdminSafepayRefundService(jdbc,payments,provider,manager);
    when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(admin))).thenReturn(true);
    when(jdbc.queryForList(contains("SELECT i.order_id"),eq(id))).thenReturn(List.of(Map.of("order_id",order)));
    o=new HashMap<>(Map.of("total",new BigDecimal("100.00"),"payment_method","DEMO","payment_status","DEMO_PAID","currency","PKR"));
    r=new HashMap<>(Map.of("status","APPROVED","refund_status","NOT_INITIATED","refund_amount",new BigDecimal("40.00")));
    when(jdbc.queryForMap(contains("FROM public.orders"),eq(order))).thenReturn(o);
    when(jdbc.queryForMap(contains("FROM public.return_requests"),eq(id))).thenReturn(r);
    when(jdbc.queryForList(contains("FROM public.safepay_sessions"),eq(order))).thenReturn(List.of(Map.of("tracker","track_test12345","merchant_key","merchant","amount_minor",10000L)));
    when(jdbc.queryForObject(contains("COALESCE(SUM"),eq(BigDecimal.class),eq(order))).thenReturn(BigDecimal.ZERO);
    when(payments.state(anyString(),anyString(),anyLong())).thenReturn("TRACKER_ENDED");
    when(provider.refund(anyString(),anyString(),anyLong(),anyLong(),anyBoolean())).thenReturn("TRACKER_PARTIAL_REFUND");
  }
  void rejected(){assertThrows(ResponseStatusException.class,()->service.refund(admin,id));verify(provider,never()).refund(anyString(),anyString(),anyLong(),anyLong(),anyBoolean());}
  @Test void administratorRequired(){when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(admin))).thenReturn(false);rejected();}
  @Test void pendingAndRejectedReturnsBlocked(){for(String status:List.of("PENDING","REJECTED","RECEIVED")){r.put("status",status);rejected();}}
  @Test void codMustUseManualWorkflow(){o.put("payment_method","COD");rejected();}
  @Test void unpaidAndFailedBlocked(){for(String status:List.of("UNPAID","FAILED","REFUNDED")){o.put("payment_status",status);rejected();}}
  @Test void missingVerifiedSessionBlocked(){when(jdbc.queryForList(contains("FROM public.safepay_sessions"),eq(order))).thenReturn(List.of());rejected();}
  @Test void zeroAmountBlocked(){r.put("refund_amount",BigDecimal.ZERO);rejected();}
  @Test void cumulativeLimitEnforced(){when(jdbc.queryForObject(contains("COALESCE(SUM"),eq(BigDecimal.class),eq(order))).thenReturn(new BigDecimal("70"));rejected();}
  @Test void unresolvedOtherReturnBlocksOrder(){when(jdbc.queryForList(contains("state IN ('PROCESSING','REVIEW')"),eq(order))).thenReturn(List.of(Map.of("return_id",UUID.randomUUID())));rejected();}
  @Test void duplicateNeverCallsProvider(){for(String state:List.of("PROCESSING","REVIEW","CONFIRMED")){when(jdbc.queryForList(contains("SELECT state FROM public.safepay_refund_attempts"),eq(id))).thenReturn(List.of(Map.of("state",state)));assertEquals(state,service.refund(admin,id).state());}verifyNoInteractions(provider,payments);}
  @Test void reservationCommitsBeforeProviderAndPartialRefundUpdatesAccounting(){
    assertEquals("CONFIRMED",service.refund(admin,id).state());
    var sequence=inOrder(jdbc,manager,payments,provider);
    sequence.verify(jdbc).update(contains("INSERT INTO public.safepay_refund_attempts"),eq(id),eq(order),eq(admin),eq("track_test12345"),eq(4000L));
    sequence.verify(manager).commit(any());
    sequence.verify(payments).state("track_test12345","merchant",10000L);
    sequence.verify(provider).refund("track_test12345","merchant",10000L,4000L,false);
    verify(jdbc).update(contains("UPDATE public.orders"),eq("PARTIALLY_REFUNDED"),eq(order));
    verify(jdbc).update(contains("UPDATE public.return_requests"),eq(admin),eq("track_test12345"),eq(id));
  }
  @Test void finalPartialRefundMarksOrderFullyRefunded(){
    o.put("payment_status","PARTIALLY_REFUNDED");
    when(jdbc.queryForObject(contains("COALESCE(SUM"),eq(BigDecimal.class),eq(order))).thenReturn(new BigDecimal("60"));
    when(payments.state(anyString(),anyString(),anyLong())).thenReturn("TRACKER_PARTIAL_REFUND");
    when(provider.refund(anyString(),anyString(),anyLong(),anyLong(),eq(true))).thenReturn("TRACKER_REFUNDED");
    assertEquals("CONFIRMED",service.refund(admin,id).state());
    verify(jdbc).update(contains("UPDATE public.orders"),eq("REFUNDED"),eq(order));
  }
  @Test void timeoutDoesNotRecordSuccess(){
    when(provider.refund(anyString(),anyString(),anyLong(),anyLong(),anyBoolean())).thenThrow(new RuntimeException("timeout"));
    assertEquals("REVIEW",service.refund(admin,id).state());
    verify(jdbc,never()).update(contains("UPDATE public.return_requests"),any(),any(),any());
    verify(jdbc).update(contains("SET state='REVIEW'"),eq(id));
  }
  @Test void mismatchedProviderStateDoesNotSendRefund(){when(payments.state(anyString(),anyString(),anyLong())).thenReturn("TRACKER_REFUNDED");assertEquals("REVIEW",service.refund(admin,id).state());verify(provider,never()).refund(anyString(),anyString(),anyLong(),anyLong(),anyBoolean());}
  @Test void databaseFailureAfterProviderSuccessLeavesReservationForReview(){
    when(jdbc.update(contains("UPDATE public.return_requests"),eq(admin),anyString(),eq(id))).thenThrow(new RuntimeException("database unavailable"));
    assertEquals("REVIEW",service.refund(admin,id).state());verify(manager).rollback(any());
  }
}
