package com.shopmart.api.vouchers;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import com.shopmart.api.orders.*;
import com.shopmart.api.orders.OrderModels.*;
import com.shopmart.api.notifications.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class VoucherOrderSafetyTests {
 JdbcTemplate jdbc;VoucherService vouchers;OrderService service;NotificationService notifications;
 UUID user=UUID.randomUUID(),product=UUID.randomUUID(),key=UUID.randomUUID(),voucher=UUID.randomUUID();
 String existingSql="""
                SELECT id, request_hash
                FROM public.orders
                WHERE user_id = ? AND idempotency_key = ?
                """;
 @SuppressWarnings("unchecked") @BeforeEach void setup(){jdbc=mock(JdbcTemplate.class);vouchers=mock(VoucherService.class);notifications=mock(NotificationService.class);service=spy(new OrderService(jdbc,notifications,vouchers));
  when(jdbc.query(startsWith("SELECT enabled"),any(RowMapper.class),eq(user))).thenReturn(List.of(true));
  when(jdbc.queryForList(existingSql,user,key)).thenReturn(List.of());
  when(jdbc.queryForList(contains("FROM public.products"),eq(product))).thenReturn(List.of(Map.of("name","Product","price",new BigDecimal("1000.00"),"stock",10,"active",true,"currency","PKR")));
  when(jdbc.update(contains("UPDATE public.products"),eq(1),eq(product),eq(1))).thenReturn(1);
  when(vouchers.forOrder(eq(user),eq("SAVE10"),anyList())).thenReturn(new VoucherService.Pricing(voucher,"SAVE10",new BigDecimal("1000.00"),new BigDecimal("100.00"),List.of(new BigDecimal("100.00"))));
  doReturn(new OrderReceipt(UUID.randomUUID(),"SM-TEST","PENDING","COD","UNPAID","900.00","PKR",Instant.now(),List.of(),null)).when(service).getOrder(eq(user),any(UUID.class));
 }
 CreateOrderRequest request(String code,String total){return new CreateOrderRequest(key,"Customer","test@example.invalid","03001234567","Address","Lahore","COD",List.of(new ItemRequest(product,1)),code,new BigDecimal(total));}
 @Test void createStoresNetTotalAndRetryDoesNotConsumeVoucherAgain(){
  service.create(user,request("SAVE10","900.00"));ArgumentCaptor<Object[]> args=ArgumentCaptor.forClass(Object[].class);verify(jdbc).update(contains("INSERT INTO public.orders"),args.capture());
  var values=args.getValue();assertEquals(new BigDecimal("900.00"),values[12]);assertEquals(new BigDecimal("100.00"),values[15]);UUID orderId=(UUID)values[0];
  verify(jdbc).update(contains("INSERT INTO public.order_items"),eq(orderId),eq(product),eq("Product"),eq(new BigDecimal("1000.00")),eq(1),eq(new BigDecimal("100.00")));
  when(jdbc.queryForList(existingSql,user,key)).thenReturn(List.of(Map.of("id",orderId,"request_hash",values[4])));
  service.create(user,request("save10","900.00"));verify(vouchers,times(1)).forOrder(eq(user),eq("SAVE10"),anyList());verify(vouchers,times(1)).redeem(eq(user),eq(orderId),any());verify(jdbc,times(1)).update(contains("UPDATE public.products"),eq(1),eq(product),eq(1));
 }
 @Test void changedQuotedPriceCannotCreateOrderOrConsumeUse(){assertThrows(VoucherService.Rejected.class,()->service.create(user,request("SAVE10","850.00")));verify(jdbc,never()).update(contains("INSERT INTO public.orders"),any(Object[].class));verify(vouchers,never()).redeem(any(),any(),any());}
 @Test void sameIdempotencyKeyCannotBeReusedWithAnotherVoucher(){service.create(user,request("SAVE10","900.00"));ArgumentCaptor<Object[]> args=ArgumentCaptor.forClass(Object[].class);verify(jdbc).update(contains("INSERT INTO public.orders"),args.capture());when(jdbc.queryForList(existingSql,user,key)).thenReturn(List.of(Map.of("id",args.getValue()[0],"request_hash",args.getValue()[4])));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.create(user,request("OTHER10","900.00")));verify(vouchers,times(1)).forOrder(any(),any(),anyList());}
}
