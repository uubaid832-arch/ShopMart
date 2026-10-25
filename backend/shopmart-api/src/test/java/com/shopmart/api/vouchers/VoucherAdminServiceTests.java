package com.shopmart.api.vouchers;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class VoucherAdminServiceTests {
 JdbcTemplate jdbc;AdminVoucherService service;UUID user=UUID.randomUUID(),id=UUID.randomUUID();Map<String,Object> row;
 AdminVoucherService.CreateRequest request(String code,String value,int total,int personal){return new AdminVoucherService.CreateRequest(id,code,"PERCENT",new BigDecimal(value),new BigDecimal("1000.00"),null,total,personal,30);}
 @BeforeEach void setup(){jdbc=mock(JdbcTemplate.class);service=new AdminVoucherService(jdbc);when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(user))).thenReturn(true);row=new HashMap<>();row.putAll(Map.of("id",id,"code","SAVE10","kind","PERCENT","value",new BigDecimal("10.00"),"min_subtotal",new BigDecimal("1000.00"),"usage_limit",100,"per_user_limit",1,"valid_days",30,"created_by",user));row.putAll(Map.of("used",0L,"enabled",true,"version",0L,"expires_at",Timestamp.from(Instant.now().plusSeconds(86400)),"created_at",Timestamp.from(Instant.now())));when(jdbc.queryForMap(contains("FROM public.vouchers v WHERE v.id=?"),eq(id))).thenReturn(row);}
 @Test void sameCreationRequestReusesOriginalCodeAndExpiry(){var first=service.create(user,request(" save10 ","10",100,1));var second=service.create(user,request("SAVE10","10.00",100,1));assertEquals(first,second);verify(jdbc,times(2)).update(contains("ON CONFLICT(id) DO NOTHING"),any(Object[].class));}
 @Test void creationIdCannotBeReusedWithChangedRules(){assertThrows(VoucherService.Rejected.class,()->service.create(user,request("SAVE10","20",100,1)));}
 @Test void duplicateCodeIsAConflict(){when(jdbc.update(contains("INSERT INTO public.vouchers"),any(Object[].class))).thenThrow(new DuplicateKeyException("test-only"));assertThrows(VoucherService.Rejected.class,()->service.create(user,request("SAVE10","10",100,1)));}
 @Test void percentagesCannotReachOneHundred(){assertThrows(VoucherService.Rejected.class,()->service.create(user,request("SAVE10","100",100,1)));verify(jdbc,never()).update(anyString(),any(Object[].class));}
 @Test void perCustomerLimitCannotExceedTotal(){assertThrows(VoucherService.Rejected.class,()->service.create(user,request("SAVE10","10",1,2)));}
 @Test void staleToggleCannotOverwriteAnotherAdminChange(){assertThrows(VoucherService.Rejected.class,()->service.toggle(user,id,new AdminVoucherService.ToggleRequest(false,0L)));}
 @Test void enabledAdminIsRequiredInDatabase(){when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(user))).thenReturn(false);assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.create(user,request("SAVE10","10",100,1)));verify(jdbc,never()).update(anyString(),any(Object[].class));}
}
