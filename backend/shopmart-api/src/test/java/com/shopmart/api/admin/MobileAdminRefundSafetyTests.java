package com.shopmart.api.admin;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.shopmart.api.returns.AdminRefundService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MobileAdminRefundSafetyTests {
  private final UUID admin=UUID.randomUUID(), orderId=UUID.randomUUID(), returnId=UUID.randomUUID();
  private JdbcTemplate jdbc;
  private AdminRefundService service;
  private Map<String,Object> order,returned;
  @BeforeEach void setup() {
    jdbc=mock(JdbcTemplate.class);service=new AdminRefundService(jdbc);
    when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(admin))).thenReturn(true);
    when(jdbc.queryForList(contains("SELECT i.order_id"),eq(returnId))).thenReturn(List.of(Map.of("order_id",orderId)));
    order=new HashMap<>(Map.of("total",new BigDecimal("100.00"),"payment_method","COD","payment_status","PAID"));
    returned=new HashMap<>(Map.of("status","APPROVED","refund_status","PENDING","refund_amount",new BigDecimal("50.00")));
    when(jdbc.queryForMap(contains("FROM public.orders"),eq(orderId))).thenReturn(order);
    when(jdbc.queryForMap(contains("FROM public.return_requests"),eq(returnId))).thenReturn(returned);
    when(jdbc.queryForObject(contains("COALESCE(SUM"),eq(BigDecimal.class),eq(orderId))).thenReturn(BigDecimal.ZERO);
  }
  private ResponseStatusException reject() { return assertThrows(ResponseStatusException.class,()->service.record(admin,returnId,new AdminRefundService.RefundRequest("TEST-REFERENCE"))); }
  private void noWrites() {verify(jdbc,never()).update(anyString(),any(Object[].class));}
  @Test void nonAdminCannotRecordCashRefund() {
    when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(admin))).thenReturn(false);
    assertEquals(403,reject().getStatusCode().value());noWrites();
  }
  @Test void goodsMustBeInspectedAndAcceptedBeforeRefundRecord() {
    returned.put("status","RECEIVED");assertEquals(409,reject().getStatusCode().value());noWrites();
  }
  @Test void demoPaymentsCannotBeRecordedAsRealCashRefunds() {
    order.put("payment_method","DEMO");order.put("payment_status","DEMO_PAID");assertEquals(409,reject().getStatusCode().value());noWrites();
  }
  @Test void unpaidCodCannotBeRefunded() {
    order.put("payment_status","UNPAID");assertEquals(409,reject().getStatusCode().value());noWrites();
  }
  @Test void cumulativeRefundsCannotExceedOrderTotal() {
    when(jdbc.queryForObject(contains("COALESCE(SUM"),eq(BigDecimal.class),eq(orderId))).thenReturn(new BigDecimal("75.00"));
    assertEquals(409,reject().getStatusCode().value());noWrites();
  }
  @Test void identicalReceiptRetryDoesNotRecordAnotherRefund() {
    returned.put("refund_status","REFUNDED");returned.put("refund_reference","TEST-REFERENCE");
    assertDoesNotThrow(()->service.record(admin,returnId,new AdminRefundService.RefundRequest("TEST-REFERENCE")));noWrites();
  }
  @Test void paidPartialRefundUpdatesLedgerAndOrderWithServerAmount() {
    assertDoesNotThrow(()->service.record(admin,returnId,new AdminRefundService.RefundRequest("TEST-REFERENCE")));
    verify(jdbc).update(contains("UPDATE public.return_requests"),eq(admin),eq("TEST-REFERENCE"),eq(returnId));
    verify(jdbc).update(contains("UPDATE public.orders"),eq("PARTIALLY_REFUNDED"),eq(orderId));
  }
}
