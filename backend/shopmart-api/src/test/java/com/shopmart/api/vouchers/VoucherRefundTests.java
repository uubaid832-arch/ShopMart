package com.shopmart.api.vouchers;
import java.math.BigDecimal;
import java.util.*;
import com.shopmart.api.returns.ReturnService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.mockito.Mockito.*;
class VoucherRefundTests {
 @Test void returnUsesNetPaidLineAmountInsteadOfOriginalPrice(){var jdbc=mock(JdbcTemplate.class);var service=new ReturnService(jdbc);UUID user=UUID.randomUUID(),order=UUID.randomUUID(),item=UUID.randomUUID();
  when(jdbc.queryForObject(contains("FROM public.users"),eq(Boolean.class),eq(user))).thenReturn(true);
  when(jdbc.queryForObject(contains("FROM public.return_requests"),eq(Boolean.class),eq(item))).thenReturn(false);
  when(jdbc.queryForList(contains("FROM public.orders"),eq(order),eq(user))).thenReturn(List.of(Map.of("status","DELIVERED","payment_status","PAID","payment_method","COD")));
  when(jdbc.queryForList(contains("FROM public.order_items"),eq(item),eq(order))).thenReturn(List.of(Map.of("unit_price",new BigDecimal("1000.00"),"quantity",2,"discount_amount",new BigDecimal("150.00"))));
  UUID id=service.create(user,new ReturnService.CreateReturnRequest(order,item,"Damaged"));verify(jdbc).update(contains("INSERT INTO public.return_requests"),eq(id),eq(item),eq("Damaged"),eq(new BigDecimal("1850.00")));
 }
}
