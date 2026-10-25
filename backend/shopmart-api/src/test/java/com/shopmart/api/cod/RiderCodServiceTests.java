package com.shopmart.api.cod;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RiderCodServiceTests {
  private JdbcTemplate jdbc;
  private RiderCodService service;
  private final UUID rider=UUID.randomUUID();
  private final UUID admin=UUID.randomUUID();
  private final UUID report=UUID.randomUUID();
  private final UUID cash=UUID.randomUUID();
  @BeforeEach void setup() { jdbc=mock(JdbcTemplate.class); service=new RiderCodService(jdbc); }
  private void riderAllowed() {
    when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq(rider),eq("RIDER"))).thenReturn(true);
  }
  @Test void dashboardRejectsUsersWithoutRiderAccess() {
    when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq(rider),eq("RIDER"))).thenReturn(false);
    assertEquals(403,assertThrows(ResponseStatusException.class,()->service.dashboard(rider)).getStatusCode().value());
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
  @Test void retryOfTheSameReportDoesNotAllocateCashAgain() {
    riderAllowed();
    when(jdbc.queryForObject(anyString(),eq(UUID.class),eq(rider))).thenReturn(rider);
    when(jdbc.queryForList(anyString(),eq(report))).thenReturn(List.of(Map.of("rider_id",rider,"note","cash received")));
    when(jdbc.query(anyString(),org.mockito.ArgumentMatchers.<RowMapper<UUID>>any(),eq(report))).thenReturn(List.of(cash));
    assertEquals(report,service.report(rider,new RiderCodService.ReportRequest(report,List.of(cash),"cash received")));
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
  @Test void sameRequestIdentifierCannotBeReusedForDifferentCash() {
    riderAllowed();
    when(jdbc.queryForObject(anyString(),eq(UUID.class),eq(rider))).thenReturn(rider);
    when(jdbc.queryForList(anyString(),eq(report))).thenReturn(List.of(Map.of("rider_id",rider,"note","")));
    when(jdbc.query(anyString(),org.mockito.ArgumentMatchers.<RowMapper<UUID>>any(),eq(report))).thenReturn(List.of(cash));
    var request=new RiderCodService.ReportRequest(report,List.of(UUID.randomUUID()),"");
    assertEquals(409,assertThrows(ResponseStatusException.class,()->service.report(rider,request)).getStatusCode().value());
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
  @Test void riderCannotConfirmTheirOwnCashHandover() {
    when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq(rider),eq("ADMIN"))).thenReturn(false);
    assertEquals(403,assertThrows(ResponseStatusException.class,()->service.decide(rider,report,new RiderCodService.DecisionRequest("CONFIRMED",""))).getStatusCode().value());
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
  @Test void repeatedConfirmationDoesNotWriteOrNotifyAgain() {
    when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq(admin),eq("ADMIN"))).thenReturn(true);
    when(jdbc.queryForList(anyString(),eq(report))).thenReturn(List.of(Map.of("status","CONFIRMED")));
    service.decide(admin,report,new RiderCodService.DecisionRequest("CONFIRMED",""));
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
  @Test void confirmedCashCannotBeRejectedLater() {
    when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq(admin),eq("ADMIN"))).thenReturn(true);
    when(jdbc.queryForList(anyString(),eq(report))).thenReturn(List.of(Map.of("status","CONFIRMED")));
    assertEquals(409,assertThrows(ResponseStatusException.class,()->service.decide(admin,report,new RiderCodService.DecisionRequest("REJECTED","Mismatch"))).getStatusCode().value());
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
  @Test void riderCannotReportAnotherRidersCollection() {
    riderAllowed();
    when(jdbc.queryForObject(anyString(),eq(UUID.class),eq(rider))).thenReturn(rider);
    when(jdbc.queryForList(anyString(),eq(report))).thenReturn(List.of());
    when(jdbc.queryForList(anyString(),eq(cash))).thenReturn(List.of(Map.of("rider_id",UUID.randomUUID(),"amount",new java.math.BigDecimal("2200.00"))));
    assertEquals(404,assertThrows(ResponseStatusException.class,()->service.report(rider,new RiderCodService.ReportRequest(report,List.of(cash),""))).getStatusCode().value());
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
  @Test void rejectionRequiresAnExplanation() {
    when(jdbc.queryForObject(anyString(),eq(Boolean.class),eq(admin),eq("ADMIN"))).thenReturn(true);
    when(jdbc.queryForList(anyString(),eq(report))).thenReturn(List.of(Map.of("status","PENDING")));
    assertEquals(400,assertThrows(ResponseStatusException.class,()->service.decide(admin,report,new RiderCodService.DecisionRequest("REJECTED"," "))).getStatusCode().value());
    verify(jdbc,never()).update(anyString(),any(Object[].class));
  }
}
