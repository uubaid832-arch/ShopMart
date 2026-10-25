package com.shopmart.api.cod;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RiderCodService {
  private final JdbcTemplate jdbc;
  public RiderCodService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  private void role(UUID id, String role) {
    Boolean valid = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM public.users WHERE id=? AND role=? AND enabled=TRUE)", Boolean.class, id, role);
    if (!Boolean.TRUE.equals(valid)) throw failure(HttpStatus.FORBIDDEN, role + " access required.");
  }
  private static ResponseStatusException failure(HttpStatus status, String text) { return new ResponseStatusException(status, text); }
  private long count(String sql, Object... args) { return jdbc.queryForObject(sql, Long.class, args); }
  private BigDecimal sum(String sql, Object... args) { return jdbc.queryForObject(sql, BigDecimal.class, args); }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Dashboard dashboard(UUID rider) {
    role(rider, "RIDER");
    long assigned = count("""
      SELECT COUNT(*) FROM public.delivery_assignments a JOIN public.orders o ON o.id=a.order_id
      WHERE a.rider_id=? AND o.status NOT IN ('DELIVERED','CANCELLED','RETURNED')
      """, rider);
    long successful = count("SELECT COUNT(DISTINCT order_id) FROM public.order_status_history WHERE changed_by=? AND status='DELIVERED'", rider);
    long failed = count("SELECT COUNT(*) FROM public.delivery_attempts WHERE rider_id=?", rider);
    long cancelled = count("SELECT COUNT(*) FROM public.delivery_assignments a JOIN public.orders o ON o.id=a.order_id WHERE a.rider_id=? AND o.status='CANCELLED'", rider);
    long warehouse = count("SELECT COUNT(DISTINCT order_id) FROM public.delivery_attempts WHERE rider_id=? AND warehouse_reported_at IS NOT NULL AND resolved_at IS NULL", rider);
    BigDecimal collected = sum("SELECT COALESCE(SUM(amount),0) FROM public.rider_cod_collections WHERE rider_id=?", rider);
    BigDecimal confirmed = sum("SELECT COALESCE(SUM(amount),0) FROM public.rider_cod_handovers WHERE rider_id=? AND status='CONFIRMED'", rider);
    BigDecimal pending = sum("SELECT COALESCE(SUM(amount),0) FROM public.rider_cod_handovers WHERE rider_id=? AND status='PENDING'", rider);
    BigDecimal unreported = sum("""
      SELECT COALESCE(SUM(c.amount),0) FROM public.rider_cod_collections c
      WHERE c.rider_id=? AND NOT EXISTS(SELECT 1 FROM public.rider_cod_handover_claims claim WHERE claim.collection_id=c.id)
      """, rider);
    return new Dashboard(assigned,successful,failed,cancelled,warehouse,
      collected.toPlainString(),confirmed.toPlainString(),pending.toPlainString(),
      unreported.toPlainString(),collected.subtract(confirmed).toPlainString());
  }

  private void page(int page, int size) {
    if (page < 0 || size < 1 || size > 50) throw failure(HttpStatus.BAD_REQUEST,"Invalid page or size.");
  }
  @Transactional(readOnly = true)
  public Page<Collection> available(UUID rider, int page, int size) {
    role(rider,"RIDER"); page(page,size);
    String condition="c.rider_id=? AND NOT EXISTS(SELECT 1 FROM public.rider_cod_handover_claims claim WHERE claim.collection_id=c.id)";
    long total=count("SELECT COUNT(*) FROM public.rider_cod_collections c WHERE "+condition,rider);
    List<Collection> items=jdbc.query("""
      SELECT c.*,o.order_number FROM public.rider_cod_collections c JOIN public.orders o ON o.id=c.order_id
      WHERE %s ORDER BY c.collected_at DESC,c.id LIMIT ? OFFSET ?
      """.formatted(condition), RiderCodService::collection,rider,size,(long)page*size);
    return new Page<>(items,page,size,total,(int)((total+size-1)/size));
  }
  private static Collection collection(ResultSet rs,int row) throws SQLException {
    return new Collection(rs.getObject("id",UUID.class),rs.getObject("order_id",UUID.class),
      rs.getString("order_number"),rs.getString("amount"),rs.getString("currency"),rs.getTimestamp("collected_at").toInstant());
  }

  @Transactional
  public UUID report(UUID rider,ReportRequest request) {
    role(rider,"RIDER");
    // Serialize submissions by this rider, including retries with the same id.
    jdbc.queryForObject("SELECT id FROM public.users WHERE id=? FOR UPDATE",UUID.class,rider);
    var ids=new TreeSet<UUID>(request.collectionIds());
    if (ids.size()!=request.collectionIds().size()) throw failure(HttpStatus.BAD_REQUEST,"Select each collection only once.");
    String note=request.note()==null?"":request.note().strip();
    var old=jdbc.queryForList("SELECT rider_id,note FROM public.rider_cod_handovers WHERE id=?",request.requestId());
    if (!old.isEmpty()) {
      var stored=old.get(0);
      Set<UUID> previous=new HashSet<>(jdbc.query("SELECT collection_id FROM public.rider_cod_handover_items WHERE handover_id=?",(rs,row)->rs.getObject(1,UUID.class),request.requestId()));
      if (!rider.equals(stored.get("rider_id")) || !note.equals(stored.get("note")) || !previous.equals(ids)) throw failure(HttpStatus.CONFLICT,"This request identifier was already used.");
      return request.requestId();
    }
    BigDecimal total=BigDecimal.ZERO;
    for (UUID id:ids) {
      var matches=jdbc.queryForList("SELECT rider_id,amount FROM public.rider_cod_collections WHERE id=? FOR UPDATE",id);
      if (matches.isEmpty() || !rider.equals(matches.get(0).get("rider_id"))) throw failure(HttpStatus.NOT_FOUND,"Collection not found.");
      if (count("SELECT COUNT(*) FROM public.rider_cod_handover_claims WHERE collection_id=?",id)>0) throw failure(HttpStatus.CONFLICT,"A selected collection is already reported. Refresh your balance.");
      total=total.add((BigDecimal)matches.get(0).get("amount"));
    }
    if (total.signum()<=0) throw failure(HttpStatus.BAD_REQUEST,"Select collected cash to report.");
    try {
      jdbc.update("INSERT INTO public.rider_cod_handovers(id,rider_id,amount,note) VALUES(?,?,?,?)",request.requestId(),rider,total,note);
      for(UUID id:ids) jdbc.update("INSERT INTO public.rider_cod_handover_items(handover_id,collection_id) VALUES(?,?)",request.requestId(),id);
    } catch(DataIntegrityViolationException conflict) {
      throw failure(HttpStatus.CONFLICT,"A collection has already been reported. Refresh your balance.");
    }
    jdbc.update("""
      INSERT INTO public.notifications(user_id,event_key,type,title,message)
      SELECT id,?,'COD_HANDOVER','COD handover awaiting confirmation',?
      FROM public.users WHERE role='ADMIN' AND enabled=TRUE ON CONFLICT(user_id,event_key) DO NOTHING
      ""","COD_REPORT:"+request.requestId(),"A rider reported handing over PKR "+total.toPlainString()+". Check the cash and confirm or reject report "+request.requestId()+".");
    return request.requestId();
  }

  @Transactional(readOnly = true)
  public Page<Handover> history(UUID user, boolean admin, String status, int page,int size) {
    role(user,admin?"ADMIN":"RIDER"); page(page,size);
    if(!Set.of("ALL","PENDING","CONFIRMED","REJECTED").contains(status)) throw failure(HttpStatus.BAD_REQUEST,"Invalid status.");
    String where=(admin?"TRUE":"h.rider_id=?")+(status.equals("ALL")?"":" AND h.status=?");
    List<Object> args=new ArrayList<>(); if(!admin) args.add(user); if(!status.equals("ALL")) args.add(status);
    long total=count("SELECT COUNT(*) FROM public.rider_cod_handovers h WHERE "+where,args.toArray());
    args.add(size); args.add((long)page*size);
    var items=jdbc.query("""
      SELECT h.*,r.name AS rider_name,a.name AS admin_name
      FROM public.rider_cod_handovers h JOIN public.users r ON r.id=h.rider_id
      LEFT JOIN public.users a ON a.id=h.decided_by
      WHERE %s ORDER BY h.created_at DESC,h.id LIMIT ? OFFSET ?
      """.formatted(where),RiderCodService::handover,args.toArray());
    return new Page<>(items,page,size,total,(int)((total+size-1)/size));
  }
  private static Handover handover(ResultSet rs,int row) throws SQLException {
    var decided=rs.getTimestamp("decided_at");
    return new Handover(rs.getObject("id",UUID.class),rs.getObject("rider_id",UUID.class),rs.getString("rider_name"),
      rs.getString("amount"),rs.getString("currency"),rs.getString("status"),rs.getString("note"),
      rs.getTimestamp("created_at").toInstant(),rs.getString("admin_name"),decided==null?null:decided.toInstant(),rs.getString("decision_note"));
  }
  @Transactional(readOnly = true)
  public Details details(UUID user,boolean admin,UUID report) {
    role(user,admin?"ADMIN":"RIDER");
    var headers=jdbc.query("""
      SELECT h.*,r.name AS rider_name,a.name AS admin_name
      FROM public.rider_cod_handovers h JOIN public.users r ON r.id=h.rider_id
      LEFT JOIN public.users a ON a.id=h.decided_by WHERE h.id=?
      """,RiderCodService::handover,report);
    if(headers.isEmpty() || (!admin && !user.equals(headers.get(0).riderId()))) throw failure(HttpStatus.NOT_FOUND,"Handover not found.");
    var items=jdbc.query("""
      SELECT c.*,o.order_number FROM public.rider_cod_handover_items i
      JOIN public.rider_cod_collections c ON c.id=i.collection_id JOIN public.orders o ON o.id=c.order_id
      WHERE i.handover_id=? ORDER BY c.collected_at,c.id
      """,RiderCodService::collection,report);
    return new Details(headers.get(0),items);
  }
  @Transactional
  public void decide(UUID admin,UUID report,DecisionRequest request) {
    role(admin,"ADMIN");
    var matches=jdbc.queryForList("SELECT * FROM public.rider_cod_handovers WHERE id=? FOR UPDATE",report);
    if(matches.isEmpty()) throw failure(HttpStatus.NOT_FOUND,"Handover not found.");
    var header=matches.get(0);
    if(request.status().equals(header.get("status"))) return;
    if(!"PENDING".equals(header.get("status"))) throw failure(HttpStatus.CONFLICT,"This handover has already been decided.");
    String note=request.note()==null?"":request.note().strip();
    if(request.status().equals("REJECTED") && note.isEmpty()) throw failure(HttpStatus.BAD_REQUEST,"Explain why the handover was rejected.");
    jdbc.update("UPDATE public.rider_cod_handovers SET status=?,decided_by=?,decision_note=? WHERE id=?",request.status(),admin,note,report);
    jdbc.update("""
      INSERT INTO public.notifications(user_id,event_key,type,title,message)
      VALUES(?,?,'COD_HANDOVER','COD handover updated',?) ON CONFLICT(user_id,event_key) DO NOTHING
      """,header.get("rider_id"),"COD_DECISION:"+report,"Your COD handover of PKR "+header.get("amount")+" was "+request.status().toLowerCase()+"."+(note.isEmpty()?"":" Administrator note: "+note));
  }

  public record ReportRequest(@NotNull UUID requestId,@NotEmpty @Size(max=100) List<@NotNull UUID> collectionIds,@Size(max=500) String note) {}
  public record DecisionRequest(@NotBlank @Pattern(regexp="CONFIRMED|REJECTED") String status,@Size(max=500) String note) {}
  public record Dashboard(long assignedDeliveries,long successfulDeliveries,long failedAttempts,long cancelledOrders,long warehousePending,
    String totalCollected,String confirmedHandovers,String pendingHandovers,String unreportedBalance,String outstandingBalance) {}
  public record Collection(UUID id,UUID orderId,String orderNumber,String amount,String currency,Instant collectedAt) {}
  public record Handover(UUID id,UUID riderId,String riderName,String amount,String currency,String status,String note,Instant createdAt,String adminName,Instant decidedAt,String decisionNote) {}
  public record Details(Handover handover,List<Collection> collections) {}
  public record Page<T>(List<T> items,int page,int size,long totalItems,int totalPages) {}
}
