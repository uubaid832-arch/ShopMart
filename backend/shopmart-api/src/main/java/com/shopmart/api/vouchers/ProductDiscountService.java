package com.shopmart.api.vouchers;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductDiscountService {
  private final JdbcTemplate jdbc;
  public ProductDiscountService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  public record Rule(@NotNull UUID productId, @NotBlank @Pattern(regexp="FIXED|PERCENT") String kind,
      @NotNull @DecimalMin("0.01") @Digits(integer=10, fraction=2) BigDecimal value) {}
  public record CreateRequest(@NotNull UUID requestId, @NotBlank @Size(max=100) String name,
      @NotEmpty @Size(max=100) List<@NotNull @Valid Rule> products) {}
  public record ToggleRequest(@NotNull Boolean enabled, @NotNull @Min(0) Long version) {}
  public record Offer(String kind, String value, String discountAmount, String discountedPrice) {}
  public record ProductRule(UUID productId, String productName, String price, String kind,
      String value, boolean enabled) {}
  public record Campaign(UUID id, String name, boolean enabled, long version,
      List<ProductRule> products, java.time.Instant createdAt) {}

  private void requireAdmin(UUID user) {
    if (!Boolean.TRUE.equals(jdbc.queryForObject(
        "SELECT EXISTS(SELECT 1 FROM public.users WHERE id=? AND enabled=TRUE AND role='ADMIN')", Boolean.class, user)))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
  }

  @Transactional(readOnly=true)
  public Map<UUID, Offer> activeOffers(Collection<UUID> ids) {
    if (ids == null || ids.isEmpty()) return Map.of();
    String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
    Map<UUID, Offer> result = new HashMap<>();
    jdbc.query("""
        SELECT i.product_id,i.kind,i.value,p.price
        FROM public.product_discount_items i
        JOIN public.product_discount_campaigns c ON c.id=i.campaign_id AND c.enabled=TRUE
        JOIN public.products p ON p.id=i.product_id AND p.active=TRUE
        WHERE i.enabled=TRUE AND i.product_id IN (""" + placeholders + ")",
        rs -> {
          UUID id = rs.getObject("product_id", UUID.class);
          BigDecimal price = rs.getBigDecimal("price").setScale(2, RoundingMode.UNNECESSARY);
          BigDecimal value = rs.getBigDecimal("value");
          BigDecimal amount = "PERCENT".equals(rs.getString("kind"))
              ? price.multiply(value).divide(new BigDecimal("100"), 2, RoundingMode.DOWN)
              : value.setScale(2, RoundingMode.UNNECESSARY);
          if (amount.signum() > 0 && amount.compareTo(price) < 0)
            result.put(id, new Offer(rs.getString("kind"), value.toPlainString(), amount.toPlainString(), price.subtract(amount).toPlainString()));
        }, ids.toArray());
    return Map.copyOf(result);
  }

  @Transactional(readOnly=true)
  public List<Campaign> list(UUID user) {
    requireAdmin(user);
    var campaigns = jdbc.queryForList("SELECT id,name,enabled,version,created_at FROM public.product_discount_campaigns ORDER BY created_at DESC,id");
    List<Campaign> result = new ArrayList<>();
    for (var c : campaigns) {
      UUID id = (UUID)c.get("id");
      var products = jdbc.query("""
          SELECT i.product_id,p.name,p.price,i.kind,i.value,i.enabled
          FROM public.product_discount_items i JOIN public.products p ON p.id=i.product_id
          WHERE i.campaign_id=? ORDER BY p.name,p.id
          """, (rs,n) -> new ProductRule(rs.getObject("product_id",UUID.class),rs.getString("name"),rs.getBigDecimal("price").toPlainString(),rs.getString("kind"),rs.getBigDecimal("value").toPlainString(),rs.getBoolean("enabled")), id);
      Object created=c.get("created_at");
      java.time.Instant createdAt=created instanceof Timestamp t?t.toInstant():((java.time.OffsetDateTime)created).toInstant();
      result.add(new Campaign(id,(String)c.get("name"),Boolean.TRUE.equals(c.get("enabled")),((Number)c.get("version")).longValue(),products,createdAt));
    }
    return List.copyOf(result);
  }

  @Transactional
  public Campaign create(UUID user, CreateRequest request) {
    requireAdmin(user);
    String name=request.name().strip();
    if (name.isEmpty()) throw new VoucherService.Rejected("Enter a campaign name.");
    Set<UUID> unique=new HashSet<>();
    for (Rule rule:request.products().stream().sorted(Comparator.comparing(Rule::productId)).toList()) {
      if (!unique.add(rule.productId())) throw new VoucherService.Rejected("Choose each product only once.");
      var rows=jdbc.queryForList("SELECT price,active FROM public.products WHERE id=? FOR UPDATE",rule.productId());
      if(rows.isEmpty()||!Boolean.TRUE.equals(rows.get(0).get("active"))) throw new VoucherService.Rejected("Choose an active product.");
      BigDecimal price=(BigDecimal)rows.get(0).get("price");
      BigDecimal amount="PERCENT".equals(rule.kind())?price.multiply(rule.value()).divide(new BigDecimal("100"),2,RoundingMode.DOWN):rule.value();
      if("PERCENT".equals(rule.kind())&&rule.value().compareTo(new BigDecimal("99"))>0) throw new VoucherService.Rejected("Product discounts must be less than 100%.");
      if(amount.signum()<=0||amount.compareTo(price)>=0) throw new VoucherService.Rejected("Each discount must leave a positive product price.");
      Boolean exists=jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.product_discount_items WHERE product_id=? AND enabled=TRUE)",Boolean.class,rule.productId());
      if(Boolean.TRUE.equals(exists)) throw new VoucherService.Rejected("A selected product already has an active automatic discount. Disable its existing campaign first.");
    }
    try {
      jdbc.update("INSERT INTO public.product_discount_campaigns(id,name,created_by) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING",request.requestId(),name,user);
      var stored=jdbc.queryForMap("SELECT name,created_by FROM public.product_discount_campaigns WHERE id=?",request.requestId());
      if(!user.equals(stored.get("created_by"))||!name.equals(stored.get("name"))) throw new VoucherService.Rejected("This campaign request was already used for different settings.");
      for(Rule rule:request.products().stream().sorted(Comparator.comparing(Rule::productId)).toList()) jdbc.update("INSERT INTO public.product_discount_items(id,campaign_id,product_id,kind,value) VALUES(?,?,?,?,?)",UUID.randomUUID(),request.requestId(),rule.productId(),rule.kind(),rule.value());
    } catch(org.springframework.dao.DuplicateKeyException ex) {
      throw new VoucherService.Rejected("One of the products already has an active discount. Refresh and try again.");
    }
    return list(user).stream().filter(c->c.id().equals(request.requestId())).findFirst().orElseThrow();
  }

  @Transactional
  public void toggle(UUID user, UUID id, ToggleRequest request) {
    requireAdmin(user);
    if (request.enabled()) {
      Boolean conflict=jdbc.queryForObject("""
          SELECT EXISTS(
            SELECT 1 FROM public.product_discount_items wanted
            JOIN public.product_discount_items other ON other.product_id=wanted.product_id AND other.enabled=TRUE AND other.campaign_id<>wanted.campaign_id
            WHERE wanted.campaign_id=?
          )
          """,Boolean.class,id);
      if(Boolean.TRUE.equals(conflict)) throw new VoucherService.Rejected("A product in this campaign is now discounted by another active campaign. Disable that campaign first.");
    }
    int updated=jdbc.update("UPDATE public.product_discount_campaigns SET enabled=?,version=version+1 WHERE id=? AND version=?",request.enabled(),id,request.version());
    if(updated!=1) throw new VoucherService.Rejected("This campaign changed. Refresh before changing its status.");
    jdbc.update("UPDATE public.product_discount_items SET enabled=? WHERE campaign_id=?",request.enabled(),id);
  }
}
