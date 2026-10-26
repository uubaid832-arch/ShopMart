package com.shopmart.api.payments;

import java.math.BigDecimal;
import java.util.*;
import com.shopmart.api.orders.OrderModels.*;
import com.shopmart.api.orders.OrderService;
import com.shopmart.api.vouchers.VoucherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SafepayCreateTests {
 JdbcTemplate jdbc; SafepayClient client; SafepayService service;
 UUID user=UUID.randomUUID(),id=UUID.randomUUID(),product=UUID.randomUUID();
 @BeforeEach void setup(){
  jdbc=mock(JdbcTemplate.class);client=mock(SafepayClient.class);
  service=new SafepayService(jdbc,client,mock(OrderService.class),mock(VoucherService.class),mock(PlatformTransactionManager.class));
  when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(user))).thenReturn(true);
  when(jdbc.queryForObject(contains("SELECT COUNT"),eq(Long.class),eq(user))).thenReturn(0L);
  when(jdbc.queryForList(contains("SELECT price,stock"),eq(product))).thenReturn(List.of(Map.of("price",new BigDecimal("100.00"),"stock",3,"active",true,"currency","PKR")));
 }
 CreateOrderRequest request(String total,List<ItemRequest> items){return new CreateOrderRequest(id,"Customer","customer@example.invalid","03001234567","Address","Lahore","DEMO",items,null,new BigDecimal(total));}
 @Test void changedTotalIsRejectedBeforeProviderCheckout(){
  assertEquals(409,assertThrows(ResponseStatusException.class,()->service.create(user,request("1.00",List.of(new ItemRequest(product,1))),"web")).getStatusCode().value());
  verify(client,never()).create(any(),anyLong(),anyString());
 }
 @Test void pendingCheckoutBlocksASecondPayment(){
  when(jdbc.queryForObject(contains("SELECT COUNT"),eq(Long.class),eq(user))).thenReturn(1L);
  assertEquals(429,assertThrows(ResponseStatusException.class,()->service.create(user,request("100.00",List.of(new ItemRequest(product,1))),"mobile")).getStatusCode().value());
  verify(client,never()).create(any(),anyLong(),anyString());
 }
 @Test void duplicateProductsCannotChargeIncorrectTotal(){
  assertEquals(400,assertThrows(ResponseStatusException.class,()->service.create(user,request("200.00",List.of(new ItemRequest(product,1),new ItemRequest(product,1))),"web")).getStatusCode().value());
  verify(client,never()).create(any(),anyLong(),anyString());
 }
 @SuppressWarnings("unchecked")
 @Test void unfinishedPaymentAlsoBlocksRegularCodCheckout(){
  var orderService=new OrderService(jdbc,mock(com.shopmart.api.notifications.NotificationService.class),mock(VoucherService.class));
  when(jdbc.query(startsWith("SELECT enabled"),any(org.springframework.jdbc.core.RowMapper.class),eq(user))).thenReturn(List.of(true));
  when(jdbc.queryForObject(contains("SELECT EXISTS(SELECT 1 FROM public.safepay_sessions"),eq(Boolean.class),eq(user))).thenReturn(true);
  var cod=new CreateOrderRequest(id,"Customer","customer@example.invalid","03001234567","Address","Lahore","COD",List.of(new ItemRequest(product,1)));
  assertEquals(409,assertThrows(ResponseStatusException.class,()->orderService.create(user,cod)).getStatusCode().value());
  verify(jdbc,never()).update(contains("INSERT INTO public.orders"),any(Object[].class));
 }
 @Test void insufficientStockCannotStartPayment(){
  assertEquals(409,assertThrows(ResponseStatusException.class,()->service.create(user,request("400.00",List.of(new ItemRequest(product,4))),"web")).getStatusCode().value());
  verify(client,never()).create(any(),anyLong(),anyString());
 }
}
