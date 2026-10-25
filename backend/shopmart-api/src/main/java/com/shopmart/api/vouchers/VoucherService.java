package com.shopmart.api.vouchers;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import com.shopmart.api.orders.OrderModels.ItemRequest;
import com.shopmart.api.orders.OrderModels.OrderLine;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VoucherService {
  private final JdbcTemplate jdbc;
  public VoucherService(JdbcTemplate jdbc){this.jdbc=jdbc;}
  public static class Rejected extends RuntimeException {public Rejected(String message){super(message);}}
  public static String normalize(String code) {
    if(code==null||code.isBlank())return null;
    String value=code.strip().toUpperCase(Locale.ROOT);
    if(!value.matches("[A-Z0-9][A-Z0-9_-]{2,39}"))throw new Rejected("Use a voucher code of 3–40 letters, numbers, hyphens or underscores.");
    return value;
  }
  public record Pricing(UUID voucherId,String code,BigDecimal subtotal,BigDecimal discount,List<BigDecimal> lineDiscounts) {}
  public record Quote(String code,String subtotal,String discountAmount,String total,String currency) {}
  public record QuoteRequest(@NotBlank @Size(max=40) String code,@NotEmpty @Size(max=50) List<@NotNull @Valid ItemRequest> items) {}

  @Transactional(readOnly=true)
  public Quote quote(UUID user,QuoteRequest request) {
    requireUser(user);
    SortedMap<UUID,Integer> quantities=new TreeMap<>();
    for(var item:request.items())if(quantities.putIfAbsent(item.productId(),item.quantity())!=null)throw new Rejected("Each product must appear only once.");
    List<OrderLine> lines=new ArrayList<>();
    for(var item:quantities.entrySet()) {
      var products=jdbc.queryForList("SELECT name,price,stock,active,currency FROM public.products WHERE id=?",item.getKey());
      if(products.isEmpty())throw new Rejected("A product is no longer available.");var p=products.get(0);
      if(!Boolean.TRUE.equals(p.get("active"))||!"PKR".equals(p.get("currency"))||((Number)p.get("stock")).intValue()<item.getValue())throw new Rejected("A product is unavailable or has insufficient stock.");
      lines.add(new OrderLine(item.getKey(),(String)p.get("name"),((BigDecimal)p.get("price")).toPlainString(),item.getValue()));
    }
    Pricing result=price(user,normalize(request.code()),lines,false);
    return new Quote(result.code(),result.subtotal().toPlainString(),result.discount().toPlainString(),result.subtotal().subtract(result.discount()).toPlainString(),"PKR");
  }
  @Transactional(propagation=Propagation.MANDATORY)
  public Pricing forOrder(UUID user,String code,List<OrderLine> lines){return price(user,normalize(code),lines,true);}
  private Pricing price(UUID user,String code,List<OrderLine> lines,boolean lock) {
    List<BigDecimal> gross=lines.stream().map(line->new BigDecimal(line.price()).multiply(BigDecimal.valueOf(line.quantity()))).toList();
    BigDecimal subtotal=gross.stream().reduce(BigDecimal.ZERO,BigDecimal::add).setScale(2);
    if(code==null)return new Pricing(null,null,subtotal,BigDecimal.ZERO.setScale(2),Collections.nCopies(lines.size(),BigDecimal.ZERO.setScale(2)));
    var rows=jdbc.queryForList("SELECT * FROM public.vouchers WHERE code=?"+(lock?" FOR UPDATE":""),code);
    if(rows.isEmpty())throw new Rejected("Voucher code not found.");var voucher=rows.get(0);
    if(!Boolean.TRUE.equals(voucher.get("enabled")))throw new Rejected("This voucher is disabled.");
    if(!((java.sql.Timestamp)voucher.get("expires_at")).toInstant().isAfter(Instant.now()))throw new Rejected("This voucher has expired.");
    if(subtotal.compareTo((BigDecimal)voucher.get("min_subtotal"))<0)throw new Rejected("Minimum product subtotal for this voucher is PKR "+voucher.get("min_subtotal")+".");
    UUID id=(UUID)voucher.get("id");
    long total=jdbc.queryForObject("SELECT COUNT(*) FROM public.voucher_redemptions WHERE voucher_id=?",Long.class,id);
    long personal=jdbc.queryForObject("SELECT COUNT(*) FROM public.voucher_redemptions WHERE voucher_id=? AND user_id=?",Long.class,id,user);
    if(total>=((Number)voucher.get("usage_limit")).longValue())throw new Rejected("This voucher has reached its usage limit.");
    if(personal>=((Number)voucher.get("per_user_limit")).longValue())throw new Rejected("You have already used this voucher the allowed number of times.");
    var amount=VoucherMath.calculate((String)voucher.get("kind"),(BigDecimal)voucher.get("value"),(BigDecimal)voucher.get("max_discount"),gross);
    return new Pricing(id,code,amount.subtotal(),amount.discount(),amount.lineDiscounts());
  }
  @Transactional(propagation=Propagation.MANDATORY)
  public void redeem(UUID user,UUID order,Pricing pricing) {
    if(pricing.voucherId()!=null)jdbc.update("INSERT INTO public.voucher_redemptions(order_id,voucher_id,user_id,discount_amount) VALUES(?,?,?,?)",order,pricing.voucherId(),user,pricing.discount());
  }
  private void requireUser(UUID user) {
    if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.users WHERE id=? AND enabled=TRUE)",Boolean.class,user)))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED);
  }
}
