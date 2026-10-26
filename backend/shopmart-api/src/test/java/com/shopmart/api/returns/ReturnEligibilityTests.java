package com.shopmart.api.returns;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;
class ReturnEligibilityTests {
 JdbcTemplate jdbc; ReturnService service;
 UUID user=UUID.randomUUID(), orderId=UUID.randomUUID(), itemId=UUID.randomUUID();
 Map<String,Object> order;
 @BeforeEach void setup() {
  jdbc=mock(JdbcTemplate.class); service=new ReturnService(jdbc);
  order=new HashMap<>(Map.of("status","DELIVERED","payment_method","COD","payment_status","PAID"));
  when(jdbc.queryForObject(contains("FROM public.users"),eq(Boolean.class),eq(user))).thenReturn(true);
  when(jdbc.queryForList(contains("SELECT status, payment_status"),eq(orderId),eq(user))).thenReturn(List.of(order));
  when(jdbc.queryForList(contains("SELECT unit_price"),eq(itemId),eq(orderId))).thenReturn(List.of(Map.of("unit_price",new BigDecimal("100.00"),"quantity",2,"discount_amount",new BigDecimal("20.00"))));
  when(jdbc.queryForObject(contains("FROM public.return_requests"),eq(Boolean.class),eq(itemId))).thenReturn(false);
 }
 void create(){service.create(user,new ReturnService.CreateReturnRequest(orderId,itemId,"Wrong size"));}
 @Test void paidCodEligible(){create();verify(jdbc).update(contains("INSERT INTO public.return_requests"),any(UUID.class),eq(itemId),eq("Wrong size"),eq(new BigDecimal("180.00")));}
 @Test void otherItemRemainsEligibleAfterPartialCodRefund(){order.put("payment_status","PARTIALLY_REFUNDED");create();}
 @Test void verifiedSafepayEligible(){order.put("payment_method","DEMO");order.put("payment_status","DEMO_PAID");when(jdbc.queryForObject(contains("FROM public.safepay_sessions"),eq(Boolean.class),eq(orderId))).thenReturn(true);create();}
 @Test void oldMockNotEligible(){order.put("payment_method","DEMO");order.put("payment_status","DEMO_PAID");assertThrows(ResponseStatusException.class,this::create);verify(jdbc,never()).update(anyString(),any(Object[].class));}
 @Test void cancelledNotEligible(){order.put("status","CANCELLED");assertThrows(ResponseStatusException.class,this::create);}
 @Test void unpaidCodNotEligible(){order.put("payment_status","UNPAID");assertThrows(ResponseStatusException.class,this::create);}
 @Test void existingReturnNotEligible(){when(jdbc.queryForObject(contains("FROM public.return_requests"),eq(Boolean.class),eq(itemId))).thenReturn(true);assertEquals(409,assertThrows(ResponseStatusException.class,this::create).getStatusCode().value());}
 @Test void anotherUsersOrderNotEligible(){when(jdbc.queryForList(contains("SELECT status, payment_status"),eq(orderId),eq(user))).thenReturn(List.of());assertEquals(404,assertThrows(ResponseStatusException.class,this::create).getStatusCode().value());}
}
