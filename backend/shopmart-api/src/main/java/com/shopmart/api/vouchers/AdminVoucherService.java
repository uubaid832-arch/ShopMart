package com.shopmart.api.vouchers;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminVoucherService {
  private final JdbcTemplate jdbc;
  public AdminVoucherService(JdbcTemplate jdbc){this.jdbc=jdbc;}
  public record CreateRequest(@NotNull UUID requestId,@NotBlank @Size(max=40) String code,
      @NotBlank @Pattern(regexp="FIXED|PERCENT") String kind,
      @NotNull @DecimalMin("0.01") @Digits(integer=10,fraction=2) BigDecimal value,
      @NotNull @DecimalMin("0") @Digits(integer=10,fraction=2) BigDecimal minSubtotal,
      @DecimalMin("0.01") @Digits(integer=10,fraction=2) BigDecimal maxDiscount,
      @Min(1) @Max(1000000) int usageLimit,@Min(1) @Max(1000000) int perUserLimit,@Min(1) @Max(3650) int validDays) {}
  public record ToggleRequest(@NotNull Boolean enabled,@NotNull @Min(0) Long version) {}
  public record Voucher(UUID id,String code,String kind,String value,String minSubtotal,String maxDiscount,
      int usageLimit,int perUserLimit,long used,Instant expiresAt,boolean enabled,long version,Instant createdAt) {}
  public record Page(List<Voucher> items,int page,int size,long totalItems,int totalPages) {}
  private void requireAdmin(UUID user) {
    if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.users WHERE id=? AND enabled=TRUE AND role='ADMIN')",Boolean.class,user)))throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }
  @Transactional(readOnly=true)
  public Page list(UUID user,int page,int size) {
    requireAdmin(user);if(page<0||size<1||size>50)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    long count=jdbc.queryForObject("SELECT COUNT(*) FROM public.vouchers",Long.class);
    var rows=jdbc.queryForList("SELECT v.*,(SELECT COUNT(*) FROM public.voucher_redemptions r WHERE r.voucher_id=v.id) AS used FROM public.vouchers v ORDER BY v.created_at DESC,v.id LIMIT ? OFFSET ?",size,(long)page*size);
    return new Page(rows.stream().map(AdminVoucherService::map).toList(),page,size,count,(int)((count+size-1)/size));
  }
  @Transactional
  public Voucher create(UUID user,CreateRequest request) {
    requireAdmin(user);String code=VoucherService.normalize(request.code());
    if(code==null)throw new VoucherService.Rejected("Enter a voucher code.");
    if("PERCENT".equals(request.kind())&&request.value().compareTo(new BigDecimal("99"))>0)throw new VoucherService.Rejected("Percentage vouchers must be between 0.01% and 99%.");
    if(request.perUserLimit()>request.usageLimit())throw new VoucherService.Rejected("Per-customer uses cannot exceed the total usage limit.");
    try {
      jdbc.update("""
          INSERT INTO public.vouchers(id,code,kind,value,min_subtotal,max_discount,usage_limit,per_user_limit,valid_days,expires_at,created_by)
          VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING
          """,request.requestId(),code,request.kind(),request.value(),request.minSubtotal(),request.maxDiscount(),request.usageLimit(),request.perUserLimit(),request.validDays(),Timestamp.from(Instant.now().plus(request.validDays(),ChronoUnit.DAYS)),user);
    } catch(DuplicateKeyException failure) {throw new VoucherService.Rejected("That voucher code already exists. Generate a different code.");}
    var row=jdbc.queryForMap("SELECT v.*,(SELECT COUNT(*) FROM public.voucher_redemptions r WHERE r.voucher_id=v.id) AS used FROM public.vouchers v WHERE v.id=?",request.requestId());
    if(!user.equals(row.get("created_by"))||!code.equals(row.get("code"))||!request.kind().equals(row.get("kind"))
        ||request.value().compareTo((BigDecimal)row.get("value"))!=0||request.minSubtotal().compareTo((BigDecimal)row.get("min_subtotal"))!=0
        ||!same(request.maxDiscount(),(BigDecimal)row.get("max_discount"))||request.usageLimit()!=((Number)row.get("usage_limit")).intValue()
        ||request.perUserLimit()!=((Number)row.get("per_user_limit")).intValue()||request.validDays()!=((Number)row.get("valid_days")).intValue())
      throw new VoucherService.Rejected("This creation request was already used for different voucher settings.");
    return map(row);
  }
  private static boolean same(BigDecimal a,BigDecimal b){return a==null?b==null:b!=null&&a.compareTo(b)==0;}
  @Transactional
  public void toggle(UUID user,UUID id,ToggleRequest request) {
    requireAdmin(user);
    if(jdbc.update("UPDATE public.vouchers SET enabled=?,version=version+1 WHERE id=? AND version=?",request.enabled(),id,request.version())!=1)
      throw new VoucherService.Rejected("This voucher changed. Refresh before changing its status.");
  }
  private static Voucher map(Map<String,Object> row){return new Voucher((UUID)row.get("id"),(String)row.get("code"),(String)row.get("kind"),row.get("value").toString(),row.get("min_subtotal").toString(),row.get("max_discount")==null?null:row.get("max_discount").toString(),((Number)row.get("usage_limit")).intValue(),((Number)row.get("per_user_limit")).intValue(),((Number)row.get("used")).longValue(),((Timestamp)row.get("expires_at")).toInstant(),Boolean.TRUE.equals(row.get("enabled")),((Number)row.get("version")).longValue(),((Timestamp)row.get("created_at")).toInstant());}
}
