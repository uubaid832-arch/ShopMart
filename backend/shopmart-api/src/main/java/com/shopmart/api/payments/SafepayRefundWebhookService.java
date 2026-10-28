package com.shopmart.api.payments;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@Service
public class SafepayRefundWebhookService {
  private final JdbcTemplate jdbc;
  private final String merchant;
  public SafepayRefundWebhookService(JdbcTemplate jdbc,
      @Value("${SHOPMART_SAFEPAY_API_KEY:}") String merchant) {
    this.jdbc=jdbc;this.merchant=merchant;
  }
  @Transactional
  public void accept(JsonNode event) {
    if (!"payment.refunded".equals(event.path("type").asText())) return;
    String eventId=event.path("token").asText(), tracker=event.path("data").path("tracker").asText();
    String owner=event.path("merchant_api_key").asText();
    JsonNode data=event.path("data");
    long refund=integer(data.path("refund_amount")), balance=integer(data.path("balance"));
    String state=data.path("state").asText();
    if(eventId.isBlank() || eventId.length()>120 || !tracker.matches("track_[A-Za-z0-9_-]{8,100}")
        || !merchant.equals(owner) || !"PKR".equals(data.path("currency").asText())
        || !Set.of("TRACKER_PARTIAL_REFUND","TRACKER_REFUNDED").contains(state)
        || (balance==0)!="TRACKER_REFUNDED".equals(state)) throw bad();
    var inserted=jdbc.queryForList("""
        INSERT INTO public.safepay_webhook_events(event_token,tracker,event_type,refund_amount_minor,balance_minor,provider_state)
        VALUES(?,?,'payment.refunded',?,?,?) ON CONFLICT(event_token) DO NOTHING RETURNING event_token
        """,eventId,tracker,refund,balance,state);
    if(inserted.isEmpty())return;
    var sessions=jdbc.queryForList("""
        SELECT s.order_id,s.amount_minor FROM public.safepay_sessions s
        WHERE s.tracker=? AND s.merchant_key=? AND s.state='PAID' AND s.order_id IS NOT NULL FOR UPDATE
        """,tracker,owner);
    if(sessions.size()!=1)throw bad();
    UUID order=(UUID)sessions.get(0).get("order_id"); long captured=((Number)sessions.get(0).get("amount_minor")).longValue();
    if(balance>captured)throw bad();
    var alreadyConfirmed=jdbc.queryForList("""
      SELECT a.return_id FROM public.safepay_refund_attempts a
      JOIN public.return_requests r ON r.id=a.return_id
      WHERE a.order_id=? AND a.tracker=? AND a.amount_minor=? AND a.state='CONFIRMED'
        AND r.refund_status='REFUNDED'
      FOR UPDATE OF a,r
      """,order,tracker,refund);
    if(alreadyConfirmed.size()==1){
      jdbc.update("""
        UPDATE public.safepay_refund_attempts SET provider_refund_reference=?,
          evidence_description='Safepay signed payment.refunded webhook',reconciled_by='Safepay webhook',
          recorded_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE return_id=?
        """,eventId,alreadyConfirmed.get(0).get("return_id"));
      return;
    }
    var candidates=jdbc.queryForList("""
      SELECT r.id,r.refund_amount,r.refund_status,a.admin_id,a.state
      FROM public.return_requests r JOIN public.order_items i ON i.id=r.order_item_id
      LEFT JOIN public.safepay_refund_attempts a ON a.return_id=r.id
      WHERE i.order_id=? AND r.status='APPROVED' AND r.refund_status='NOT_INITIATED'
        AND r.refund_amount=? AND (a.return_id IS NULL OR a.state IN ('REVIEW','PROCESSING'))
      FOR UPDATE OF r
      """,order,BigDecimal.valueOf(refund,2));
    if(candidates.size()!=1)throw bad();
    var candidate=candidates.get(0); UUID returnId=(UUID)candidate.get("id");
    BigDecimal previous=jdbc.queryForObject("""
      SELECT COALESCE(SUM(r.refund_amount),0) FROM public.return_requests r JOIN public.order_items i ON i.id=r.order_item_id
      WHERE i.order_id=? AND r.refund_status='REFUNDED'
      """,BigDecimal.class,order);
    long cumulative=previous.movePointRight(2).longValueExact()+refund;
    if(cumulative>captured || captured-cumulative!=balance || (balance==0)!="TRACKER_REFUNDED".equals(state))throw bad();
    Object admin=candidate.get("admin_id");
    jdbc.update("""
      UPDATE public.return_requests SET refund_status='REFUNDED',refunded_by=?,refunded_at=CURRENT_TIMESTAMP,
      refund_reference=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND refund_status='NOT_INITIATED'
      """,admin,eventId,returnId);
    jdbc.update("""
      UPDATE public.orders SET payment_status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?
      """,balance==0?"REFUNDED":"PARTIALLY_REFUNDED",order);
    if(candidate.get("state")==null){
      jdbc.update("""
        INSERT INTO public.safepay_refund_attempts(return_id,order_id,admin_id,tracker,amount_minor,state,
          provider_state,provider_refund_reference,evidence_description,reconciled_by,recorded_at)
        VALUES(?,?,NULL,?,?, 'CONFIRMED',?,?,?,?,CURRENT_TIMESTAMP)
        """,returnId,order,tracker,refund,state,eventId,"Safepay signed payment.refunded webhook", "Safepay webhook");
    }else{
      jdbc.update("""
        UPDATE public.safepay_refund_attempts SET state='CONFIRMED',provider_state=?,
          provider_refund_reference=?,evidence_description='Safepay signed payment.refunded webhook',
          reconciled_by='Safepay webhook',recorded_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE return_id=? AND state IN ('REVIEW','PROCESSING')
        """,state,eventId,returnId);
    }
  }
  private static long integer(JsonNode n){try{String s=n.asText();if(!s.matches("[0-9]{1,18}"))throw bad();return Long.parseLong(s);}catch(NumberFormatException e){throw bad();}}
  private static ResponseStatusException bad(){return new ResponseStatusException(HttpStatus.BAD_REQUEST,"Refund webhook did not match a verified eligible ShopMart return.");}
}
