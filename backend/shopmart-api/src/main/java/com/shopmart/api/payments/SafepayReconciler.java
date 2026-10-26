package com.shopmart.api.payments;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
public class SafepayReconciler {
 private final JdbcTemplate jdbc;private final SafepayClient client;private final SafepayService service;
 public SafepayReconciler(JdbcTemplate jdbc,SafepayClient client,SafepayService service){this.jdbc=jdbc;this.client=client;this.service=service;}
 @Scheduled(fixedDelay=60000,initialDelay=30000) public void check(){
  if(!client.enabled())return;
  for(UUID id:jdbc.query("SELECT id FROM public.safepay_sessions WHERE state='PENDING' AND next_check_at<=CURRENT_TIMESTAMP ORDER BY next_check_at,id LIMIT 5",(rs,row)->rs.getObject(1,UUID.class))){
   try{service.reconcile(id);}catch(RuntimeException ignored){jdbc.update("UPDATE public.safepay_sessions SET next_check_at=CURRENT_TIMESTAMP+INTERVAL '5 minutes' WHERE id=? AND state='PENDING'",id);}
  }
 }
}
