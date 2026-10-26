package com.shopmart.api.payments;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import com.shopmart.api.orders.OrderModels.*;
import com.shopmart.api.orders.OrderService;
import com.shopmart.api.vouchers.VoucherService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

@Service
public class SafepayService {
  private final JdbcTemplate jdbc;private final SafepayClient client;private final OrderService orders;
  private final VoucherService vouchers;private final TransactionTemplate orderTransaction;
  private final JsonMapper json=JsonMapper.builder().build();
  public SafepayService(JdbcTemplate jdbc,SafepayClient client,OrderService orders,VoucherService vouchers,PlatformTransactionManager manager){
    this.jdbc=jdbc;this.client=client;this.orders=orders;this.vouchers=vouchers;
    orderTransaction=new TransactionTemplate(manager);orderTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }
  public record Session(UUID id,String state,String checkoutUrl,String total,String currency,String tracker,OrderReceipt order,String message) {}
  @Transactional
  public Session create(UUID user,CreateOrderRequest input,String source) {
    client.requireEnabled();requireUser(user);
    jdbc.queryForList("SELECT id FROM public.users WHERE id=? FOR UPDATE",user);
    var normalized=normalize(input,input.expectedTotal());
    String hash=hash(write(normalized)+":"+source);
    // Serialize only retries of this session. No product inventory is reserved before payment.
    jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",input.idempotencyKey().toString());
    var existing=jdbc.queryForList("SELECT * FROM public.safepay_sessions WHERE id=?",input.idempotencyKey());
    if(!existing.isEmpty()){
      var row=existing.get(0);if(!user.equals(row.get("user_id")))throw failure(404,"Checkout not found.");
      if(!hash.equals(row.get("request_hash")))throw failure(409,"This checkout already has different details. Resume the saved payment instead of starting another.");
      return response(row);
    }
    long pending=jdbc.queryForObject("SELECT COUNT(*) FROM public.safepay_sessions WHERE user_id=? AND state IN ('PENDING','REVIEW')",Long.class,user);
    if(pending>=1)throw failure(429,"You have unfinished Safepay checkouts. Resume them before starting another.");
    var quantities=new TreeMap<UUID,Integer>();BigDecimal subtotal=BigDecimal.ZERO;
    for(var item:normalized.items()){
      if(quantities.putIfAbsent(item.productId(),item.quantity())!=null)throw failure(400,"Each product must appear only once.");
      var rows=jdbc.queryForList("SELECT price,stock,active,currency FROM public.products WHERE id=?",item.productId());
      if(rows.isEmpty())throw failure(409,"A product is no longer available.");var product=rows.get(0);
      if(!Boolean.TRUE.equals(product.get("active")) || !"PKR".equals(product.get("currency")) || ((Number)product.get("stock")).intValue()<item.quantity())throw failure(409,"A product is unavailable or has insufficient stock.");
      subtotal=subtotal.add(((BigDecimal)product.get("price")).multiply(BigDecimal.valueOf(item.quantity())));
    }
    BigDecimal total=normalized.voucherCode()==null?subtotal:new BigDecimal(vouchers.quote(user,new VoucherService.QuoteRequest(normalized.voucherCode(),normalized.items())).total());
    if(input.expectedTotal()!=null && input.expectedTotal().compareTo(total)!=0)throw failure(409,"The total changed. Review your cart and voucher first.");
    long minor;try{minor=total.movePointRight(2).longValueExact();}catch(ArithmeticException error){throw failure(400,"The checkout total is too large.");}
    if(minor<=0)throw failure(400,"The checkout total must be positive.");
    var provider=client.create(input.idempotencyKey(),minor,source);
    jdbc.update("""
        INSERT INTO public.safepay_sessions(id,user_id,request_hash,order_payload,amount_minor,merchant_key,tracker,checkout_url,source)
        VALUES(?,?,?,?,?,?,?,?,?)
        """,input.idempotencyKey(),user,hash,write(normalize(normalized,total)),minor,client.merchant(),provider.tracker(),provider.url(),source);
    return get(user,input.idempotencyKey());
  }
  @Transactional(readOnly=true)
  public Session active(UUID user){requireUser(user);var rows=jdbc.queryForList("SELECT * FROM public.safepay_sessions WHERE user_id=? AND state IN ('PENDING','REVIEW') ORDER BY created_at DESC LIMIT 1",user);return rows.isEmpty()?null:response(rows.get(0));}
  @Transactional(readOnly=true)
  public Session get(UUID user,UUID id){requireUser(user);var rows=jdbc.queryForList("SELECT * FROM public.safepay_sessions WHERE id=? AND user_id=?",id,user);if(rows.isEmpty())throw failure(404,"Checkout not found.");return response(rows.get(0));}
  @Transactional
  public Session resume(UUID user,UUID id){
    requireUser(user);var current=reconcile(id,user);
    if(!"PENDING".equals(current.state()))return current;
    String source=jdbc.queryForObject("SELECT source FROM public.safepay_sessions WHERE id=?",String.class,id);
    var checkout=client.reopen(current.tracker(),source);
    jdbc.update("UPDATE public.safepay_sessions SET checkout_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",checkout.url(),id);
    return get(user,id);
  }
  @Transactional
  public Session verify(UUID user,UUID id){requireUser(user);return reconcile(id,user);}
  @Transactional
  public Session reconcile(UUID id){return reconcile(id,null);}
  private Session reconcile(UUID id,UUID owner){
    client.requireEnabled();
    var rows=jdbc.queryForList("SELECT * FROM public.safepay_sessions WHERE id=? FOR UPDATE",id);
    if(rows.isEmpty() || (owner!=null && !owner.equals(rows.get(0).get("user_id"))))throw failure(404,"Checkout not found.");
    var row=rows.get(0);UUID user=(UUID)row.get("user_id");String state=(String)row.get("state");
    if(Set.of("PAID","CANCELLED","REFUNDED").contains(state))return response(row);
    String provider=client.state((String)row.get("tracker"),(String)row.get("merchant_key"),((Number)row.get("amount_minor")).longValue());
    UUID orderId=null;
    if("TRACKER_ENDED".equals(provider)){
      try {
        CreateOrderRequest request=json.readValue((String)row.get("order_payload"),CreateOrderRequest.class);
        // A committed order can be recovered by the same idempotency key after a crash/retry.
        OrderReceipt order=orderTransaction.execute(status->orders.createSafepayVerified(user,request));
        orderId=Objects.requireNonNull(order).id();state="PAID";
      } catch(ResponseStatusException | VoucherService.Rejected error){
        state="REVIEW";
        jdbc.update("""
          INSERT INTO public.notifications(user_id,event_key,type,title,message)
          SELECT id,?,'PAYMENT_REVIEW','Safepay sandbox checkout needs review',?
          FROM public.users WHERE enabled=TRUE AND role='ADMIN' ON CONFLICT(user_id,event_key) DO NOTHING
          ""","SAFEPAY_REVIEW:"+id,"Sandbox payment verified, but stock, prices, account access or voucher eligibility changed. Do not request another payment. Review Safepay tracker "+row.get("tracker")+"; checkout reference "+id+". No real money was charged.");
      }
    }else if(Set.of("TRACKER_CANCELLED","TRACKER_EXPIRED","TRACKER_REVERSED","TRACKER_VOIDED").contains(provider))state="CANCELLED";
    else if("TRACKER_REFUNDED".equals(provider))state="REFUNDED";
    jdbc.update("UPDATE public.safepay_sessions SET state=?,order_id=?,provider_state=?,next_check_at=CURRENT_TIMESTAMP+INTERVAL '1 minute',updated_at=CURRENT_TIMESTAMP WHERE id=?",state,orderId,provider,id);
    var changed=new HashMap<>(row);changed.put("state",state);changed.put("order_id",orderId);return response(changed);
  }
  private Session response(Map<String,Object> row){
    String state=(String)row.get("state");UUID user=(UUID)row.get("user_id");UUID order=(UUID)row.get("order_id");
    return new Session((UUID)row.get("id"),state,"PENDING".equals(state)?(String)row.get("checkout_url"):null,
      BigDecimal.valueOf(((Number)row.get("amount_minor")).longValue(),2).toPlainString(),"PKR",(String)row.get("tracker"),
      order==null?null:orders.getOrder(user,order),
      switch(state){case "PAID"->"Safepay sandbox payment verified and order placed. No real money charged.";case "REVIEW"->"Payment verified, but your order needs assistance because stock, prices or voucher eligibility changed. Do not pay again. Contact ShopMart with this checkout reference.";case "CANCELLED"->"Safepay confirms this payment was cancelled or expired. No order was placed.";case "REFUNDED"->"This sandbox payment was refunded. No order was placed.";default->"Awaiting confirmation from Safepay. Complete the hosted checkout, then check payment.";});
  }
  private void requireUser(UUID user){if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.users WHERE id=? AND enabled=TRUE)",Boolean.class,user)))throw failure(401,"Please sign in again.");}
  static CreateOrderRequest normalize(CreateOrderRequest r,BigDecimal expected){return new CreateOrderRequest(r.idempotencyKey(),r.name().strip(),r.email().strip().toLowerCase(Locale.ROOT),r.phone().strip(),r.address().strip(),r.city().strip(),"DEMO",r.items().stream().sorted(Comparator.comparing(ItemRequest::productId)).toList(),VoucherService.normalize(r.voucherCode()),expected);}
  private String write(Object value){return json.writeValueAsString(value);}
  private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException error){throw new IllegalStateException(error);}}
  private static ResponseStatusException failure(int code,String message){return new ResponseStatusException(HttpStatus.valueOf(code),message);}
}
