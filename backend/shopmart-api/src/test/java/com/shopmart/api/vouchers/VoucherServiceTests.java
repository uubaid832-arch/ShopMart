package com.shopmart.api.vouchers;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import com.shopmart.api.orders.OrderModels.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class VoucherServiceTests {
 JdbcTemplate jdbc;VoucherService service;UUID user=UUID.randomUUID(),voucher=UUID.randomUUID(),product=UUID.randomUUID();Map<String,Object> row;
 List<OrderLine> lines;
 @BeforeEach void setup(){jdbc=mock(JdbcTemplate.class);service=new VoucherService(jdbc);row=new HashMap<>(Map.of("id",voucher,"code","SAVE10","kind","PERCENT","value",new BigDecimal("10.00"),"min_subtotal",new BigDecimal("500.00"),"expires_at",Timestamp.from(Instant.now().plusSeconds(3600)),"enabled",true,"usage_limit",10,"per_user_limit",1));
  when(jdbc.queryForList("SELECT * FROM public.vouchers WHERE code=? FOR UPDATE","SAVE10")).thenReturn(List.of(row));
  when(jdbc.queryForList("SELECT * FROM public.vouchers WHERE code=?","SAVE10")).thenReturn(List.of(row));
  when(jdbc.queryForObject("SELECT COUNT(*) FROM public.voucher_redemptions WHERE voucher_id=?",Long.class,voucher)).thenReturn(0L);
  when(jdbc.queryForObject("SELECT COUNT(*) FROM public.voucher_redemptions WHERE voucher_id=? AND user_id=?",Long.class,voucher,user)).thenReturn(0L);
  lines=List.of(new OrderLine(product,"Product","1000.00",2));
 }
 @Test void finalOrderLocksVoucherBeforeCheckingLimits(){var priced=service.forOrder(user," save10 ",lines);assertEquals(new BigDecimal("200.00"),priced.discount());verify(jdbc).queryForList("SELECT * FROM public.vouchers WHERE code=? FOR UPDATE","SAVE10");}
 @Test void noCodeDoesNotConsumeOrQueryVouchers(){assertEquals(new BigDecimal("0.00"),service.forOrder(user,null,lines).discount());verifyNoInteractions(jdbc);}
 @Test void disabledCodeRejected(){row.put("enabled",false);assertThrows(VoucherService.Rejected.class,()->service.forOrder(user,"SAVE10",lines));}
 @Test void expiredCodeRejected(){row.put("expires_at",Timestamp.from(Instant.now().minusSeconds(1)));assertThrows(VoucherService.Rejected.class,()->service.forOrder(user,"SAVE10",lines));}
 @Test void minimumSpendCheckedAgainstServerSubtotal(){row.put("min_subtotal",new BigDecimal("2500.00"));assertThrows(VoucherService.Rejected.class,()->service.forOrder(user,"SAVE10",lines));}
 @Test void totalAndPersonalLimitsCannotBeExceeded(){when(jdbc.queryForObject("SELECT COUNT(*) FROM public.voucher_redemptions WHERE voucher_id=?",Long.class,voucher)).thenReturn(10L);assertThrows(VoucherService.Rejected.class,()->service.forOrder(user,"SAVE10",lines));when(jdbc.queryForObject("SELECT COUNT(*) FROM public.voucher_redemptions WHERE voucher_id=?",Long.class,voucher)).thenReturn(0L);when(jdbc.queryForObject("SELECT COUNT(*) FROM public.voucher_redemptions WHERE voucher_id=? AND user_id=?",Long.class,voucher,user)).thenReturn(1L);assertThrows(VoucherService.Rejected.class,()->service.forOrder(user,"SAVE10",lines));}
 @Test void previewUsesCatalogPriceAndNeverReservesAUse(){
  when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(user))).thenReturn(true);
  when(jdbc.queryForList("SELECT name,price,stock,active,currency FROM public.products WHERE id=?",product)).thenReturn(List.of(Map.of("name","Product","price",new BigDecimal("1000.00"),"stock",5,"active",true,"currency","PKR")));
  var quote=service.quote(user,new VoucherService.QuoteRequest("SAVE10",List.of(new ItemRequest(product,2))));assertEquals("1800.00",quote.total());verify(jdbc,never()).update(anyString(),any(Object[].class));verify(jdbc,never()).queryForList(contains("FOR UPDATE"),any(Object[].class));
 }
 @Test void invalidCodeCharactersRejected(){assertThrows(VoucherService.Rejected.class,()->VoucherService.normalize("A' OR 1=1"));}
}
