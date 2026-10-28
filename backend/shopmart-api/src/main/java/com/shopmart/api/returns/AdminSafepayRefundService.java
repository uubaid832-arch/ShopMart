package com.shopmart.api.returns;

import java.math.BigDecimal;
import java.util.*;
import com.shopmart.api.payments.SafepayClient;
import com.shopmart.api.payments.SafepayRefundClient;
import org.springframework.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminSafepayRefundService {
  private static final Logger log = LoggerFactory.getLogger(AdminSafepayRefundService.class);
  private final JdbcTemplate jdbc;
  private final SafepayClient payments;
  private final SafepayRefundClient refunds;
  private final TransactionTemplate tx;
  public AdminSafepayRefundService(JdbcTemplate jdbc, SafepayClient payments, SafepayRefundClient refunds,
      PlatformTransactionManager manager) {
    this.jdbc=jdbc; this.payments=payments; this.refunds=refunds;
    tx=new TransactionTemplate(manager);
    tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }
  public record Result(String state, String message) {}
  private record Attempt(UUID order, String tracker, String merchant, long captured, long amount,
      BigDecimal cumulative, boolean existing, String state) {}
  public Result refund(UUID admin, UUID id) {
    Attempt a=Objects.requireNonNull(tx.execute(s -> reserve(admin,id)));
    if(a.existing()) return result(a.state());
    // Reservation has committed BEFORE any provider call. Never retry this external mutation.
    String stage = "verify_original_payment";
    try {
      String before=payments.state(a.tracker(),a.merchant(),a.captured());
      String expected=a.cumulative().compareTo(BigDecimal.valueOf(a.amount(),2))==0
          ? "TRACKER_ENDED" : "TRACKER_PARTIAL_REFUND";
      if(!expected.equals(before)) throw new IllegalStateException("Provider payment needs review");
      stage = "submit_sandbox_refund";
      String provider=refunds.refund(a.tracker(),a.merchant(),a.captured(),a.amount(),
          a.cumulative().compareTo(BigDecimal.valueOf(a.captured(),2))==0);
      stage = "persist_provider_confirmation";
      tx.executeWithoutResult(s -> {
        jdbc.queryForMap("SELECT id FROM public.orders WHERE id=? FOR UPDATE",a.order());
        jdbc.update("""
            UPDATE public.return_requests SET refund_status='REFUNDED', refunded_by=?,
            refunded_at=CURRENT_TIMESTAMP, refund_reference=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
            """,admin,a.tracker(),id);
        jdbc.update("""
            UPDATE public.orders SET payment_status=?, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?
            """,a.cumulative().compareTo(BigDecimal.valueOf(a.captured(),2))==0 ? "REFUNDED" : "PARTIALLY_REFUNDED",a.order());
        jdbc.update("""
            UPDATE public.safepay_refund_attempts SET state='CONFIRMED',provider_state=?,updated_at=CURRENT_TIMESTAMP WHERE return_id=?
            """,provider,id);
      });
      return result("CONFIRMED");
    } catch (RuntimeException uncertain) {
      // Only a stage and Java exception type are logged; never a key, token, tracker or provider body.
      log.warn("Safepay refund unresolved: returnId={}, stage={}, exceptionType={}",
          id, stage, uncertain.getClass().getSimpleName());
      // Also covers local commit failure AFTER a successful remote refund. Do not leak provider bodies.
      tx.executeWithoutResult(s -> jdbc.update("""
          UPDATE public.safepay_refund_attempts SET state='REVIEW',updated_at=CURRENT_TIMESTAMP
          WHERE return_id=? AND state='PROCESSING'
          """,id));
      return result("REVIEW");
    }
  }
  private Attempt reserve(UUID admin, UUID id) {
    if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.users WHERE id=? AND enabled=TRUE AND role='ADMIN')",Boolean.class,admin)))
      throw fail(403,"Administrator access is required.");
    var ids=jdbc.queryForList("SELECT i.order_id FROM public.return_requests r JOIN public.order_items i ON i.id=r.order_item_id WHERE r.id=?",id);
    if(ids.isEmpty()) throw fail(404,"Return request not found.");
    UUID order=(UUID)ids.get(0).get("order_id");
    var o=jdbc.queryForMap("SELECT total,payment_method,payment_status,currency FROM public.orders WHERE id=? FOR UPDATE",order);
    var r=jdbc.queryForMap("SELECT status,refund_status,refund_amount FROM public.return_requests WHERE id=? FOR UPDATE",id);
    var prior=jdbc.queryForList("SELECT state FROM public.safepay_refund_attempts WHERE return_id=?",id);
    if(!prior.isEmpty()) return new Attempt(order,null,null,0,0,null,true,(String)prior.get(0).get("state"));
    if(!"APPROVED".equals(r.get("status")) || !"NOT_INITIATED".equals(r.get("refund_status"))) throw fail(409,"The return must be approved and not already refunded.");
    if(!"DEMO".equals(o.get("payment_method")) || !Set.of("DEMO_PAID","PARTIALLY_REFUNDED").contains(o.get("payment_status")) || !"PKR".equals(o.get("currency")))
      throw fail(409,"Only verified paid Safepay orders support this action.");
    var sessions=jdbc.queryForList("SELECT tracker,merchant_key,amount_minor FROM public.safepay_sessions WHERE order_id=? AND state='PAID' AND provider_state='TRACKER_ENDED'",order);
    if(sessions.size()!=1) throw fail(409,"Original verified Safepay payment is missing.");
    if(!jdbc.queryForList("SELECT return_id FROM public.safepay_refund_attempts WHERE order_id=? AND state IN ('PROCESSING','REVIEW')",order).isEmpty())
      throw fail(409,"An earlier refund requires verification. Do not submit another refund.");
    var session=sessions.get(0);
    long captured=((Number)session.get("amount_minor")).longValue();
    BigDecimal amount=(BigDecimal)r.get("refund_amount");
    long minor;
    try { minor=amount.movePointRight(2).longValueExact(); } catch(ArithmeticException ex){throw fail(409,"Invalid refund amount.");}
    BigDecimal previous=jdbc.queryForObject("""
        SELECT COALESCE(SUM(r.refund_amount),0) FROM public.return_requests r
        JOIN public.order_items i ON i.id=r.order_item_id WHERE i.order_id=? AND r.refund_status='REFUNDED'
        """,BigDecimal.class,order);
    BigDecimal cumulative=previous.add(amount);
    if(minor<=0 || captured<=0 || BigDecimal.valueOf(captured,2).compareTo((BigDecimal)o.get("total"))!=0
        || cumulative.compareTo(BigDecimal.valueOf(captured,2))>0) throw fail(409,"Refund exceeds the verified captured balance.");
    payments.requireEnabled(); refunds.requireConfigured();
    jdbc.update("""
        INSERT INTO public.safepay_refund_attempts(return_id,order_id,admin_id,tracker,amount_minor,state)
        VALUES(?,?,?,?,?,'PROCESSING')
        """,id,order,admin,session.get("tracker"),minor);
    return new Attempt(order,(String)session.get("tracker"),(String)session.get("merchant_key"),captured,minor,cumulative,false,"PROCESSING");
  }
  private static Result result(String state) {
    return new Result(state,"CONFIRMED".equals(state) ? "Safepay sandbox refund confirmed. Revenue has been updated."
        : "Refund pending verification. Do not refund again. Ask support to reconcile this return with Safepay.");
  }
  private static ResponseStatusException fail(int status,String message){return new ResponseStatusException(HttpStatus.valueOf(status),message);}
}
