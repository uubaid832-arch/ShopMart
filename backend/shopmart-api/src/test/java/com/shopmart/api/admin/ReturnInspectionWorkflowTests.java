package com.shopmart.api.admin;

import java.util.*;
import com.shopmart.api.returns.AdminReturnService;
import com.shopmart.api.notifications.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class ReturnInspectionWorkflowTests {
  UUID admin=UUID.randomUUID(), order=UUID.randomUUID(), id=UUID.randomUUID();
  JdbcTemplate jdbc; AdminReturnService service; Map<String,Object> saved;
  @BeforeEach void setup() {
    jdbc=mock(JdbcTemplate.class);service=new AdminReturnService(jdbc,mock(NotificationService.class));
    when(jdbc.queryForObject(contains("SELECT EXISTS"),eq(Boolean.class),eq(admin))).thenReturn(true);
    when(jdbc.query(contains("SELECT i.order_id"),org.mockito.ArgumentMatchers.<RowMapper<UUID>>any(),eq(id))).thenReturn(List.of(order));
    saved=new HashMap<>();saved.put("status","PENDING");saved.put("instructions_sent_at",null);saved.put("rejection_reason",null);
    when(jdbc.queryForMap(contains("SELECT status, instructions_sent_at"),eq(id))).thenReturn(saved);
  }
  void change(String status,String reason){service.updateStatus(admin,id,new AdminReturnService.StatusRequest(status,reason));}
  void noWrites(){verify(jdbc,never()).update(anyString(),any(Object[].class));}
  @Test void cannotAcceptOrRejectBeforeReceipt(){
    assertEquals(409,assertThrows(ResponseStatusException.class,()->change("APPROVED",null)).getStatusCode().value());
    assertEquals(409,assertThrows(ResponseStatusException.class,()->change("REJECTED","Damaged")).getStatusCode().value());noWrites();
  }
  @Test void cannotReceiveBeforeSendingInstructions(){assertEquals(409,assertThrows(ResponseStatusException.class,()->change("RECEIVED",null)).getStatusCode().value());noWrites();}
  @Test void recordingContactDoesNotApproveOrReceiveGoods(){change("CONTACTED",null);verify(jdbc).update(contains("SET instructions_sent_by"),eq(admin),eq(id));}
  @Test void repeatedContactIsIdempotent(){saved.put("instructions_sent_at",java.time.Instant.now());change("CONTACTED",null);noWrites();}
  @Test void receiptAwaitsInspectionAndDoesNotReturnOrder(){saved.put("instructions_sent_at",java.time.Instant.now());change("RECEIVED",null);verify(jdbc).update(contains("SET status='RECEIVED'"),eq(admin),eq(id));verify(jdbc,never()).update(contains("UPDATE public.orders"),any(Object[].class));}
  @Test void rejectionRequiresAnExplanation(){saved.put("status","RECEIVED");assertEquals(400,assertThrows(ResponseStatusException.class,()->change("REJECTED"," ")).getStatusCode().value());noWrites();}
  @Test void rejectionRecordsInspectionReasonWithoutRefund(){saved.put("status","RECEIVED");change("REJECTED"," Product damaged ");verify(jdbc).update(contains("rejection_reason=?"),eq("REJECTED"),eq(admin),eq("Product damaged"),eq(id));verify(jdbc,never()).update(contains("refund_status"),any(Object[].class));}
  @Test void acceptanceRequiresReceipt(){saved.put("status","RECEIVED");change("APPROVED",null);verify(jdbc).update(contains("rejection_reason=?"),eq("APPROVED"),eq(admin),isNull(),eq(id));}
  @Test void sameRejectionRetryDoesNotWriteTwice(){saved.put("status","REJECTED");saved.put("rejection_reason","Damaged");change("REJECTED","Damaged");noWrites();}
  @Test void finalRejectionCannotBeChanged(){saved.put("status","REJECTED");saved.put("rejection_reason","Damaged");assertThrows(ResponseStatusException.class,()->change("REJECTED","Another reason"));noWrites();}
}
