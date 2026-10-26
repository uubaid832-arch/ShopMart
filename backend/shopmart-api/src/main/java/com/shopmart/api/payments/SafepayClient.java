package com.shopmart.api.payments;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

/** Sandbox only. Card data is collected by Safepay, never ShopMart. */
@Component
public class SafepayClient {
  public static final String HOST="https://sandbox.api.getsafepay.com";
  private final RestClient http;
  private final String merchant;
  private final boolean enabled;
  private final String returnUrl;
  @org.springframework.beans.factory.annotation.Autowired
  public SafepayClient(@Value("${SHOPMART_SAFEPAY_ENABLED:false}") boolean enabled,
      @Value("${SHOPMART_SAFEPAY_API_KEY:}") String apiKey,
      @Value("${SHOPMART_SAFEPAY_SECRET_KEY:}") String secret,
      @Value("${SHOPMART_PUBLIC_URL:https://shopmart-i67s.onrender.com}") String origin) {
    this(enabled, apiKey, secret, origin, builder(secret));
  }
  SafepayClient(boolean enabled,String apiKey,String secret,String origin,RestClient.Builder builder) {
    this.enabled=enabled;this.merchant=apiKey.strip();
    if(enabled && (merchant.isBlank() || secret.isBlank() || merchant.contains("\n") || secret.contains("\n")))
      throw new IllegalArgumentException("Safepay sandbox requires both backend environment keys.");
    java.net.URI site=java.net.URI.create(origin);
    if(site.getHost()==null || site.getUserInfo()!=null || site.getQuery()!=null || site.getFragment()!=null || (!site.getPath().isEmpty() && !"/".equals(site.getPath())) ||
       !("https".equals(site.getScheme()) || ("http".equals(site.getScheme()) && Set.of("localhost","127.0.0.1").contains(site.getHost()))))
      throw new IllegalArgumentException("SHOPMART_PUBLIC_URL must be your HTTPS origin, or localhost for local development.");
    this.returnUrl=origin.replaceAll("/+$","")+"/api/checkout/safepay/return";
    this.http=builder.build();
  }
  public static RestClient.Builder builder(String secret) {
    var factory=new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    factory.setReadTimeout(Duration.ofSeconds(15));
    return RestClient.builder().baseUrl(HOST).requestFactory(factory)
        .defaultHeader("X-SFPY-MERCHANT-SECRET",secret.strip())
        .defaultHeader("Content-Type","application/json");
  }
  public boolean enabled(){return enabled;}
  public String merchant(){return merchant;}
  public record Checkout(String tracker,String url) {}
  public Checkout create(UUID id,long amount,String source) {
    requireEnabled();
    try {
      JsonNode created=http.post().uri("/order/payments/v3/").body(Map.of(
          "merchant_api_key",merchant,"intent","CYBERSOURCE","mode","payment","entry_mode","raw",
          "currency","PKR","amount",amount,"include_fees",false,
          "metadata",Map.of("order_id",id.toString(),"source","shopmart_sandbox"))).retrieve().body(JsonNode.class);
      String tracker=created==null?"":created.path("data").path("tracker").path("token").asText("");
      if(!tracker.matches("track_[A-Za-z0-9_-]{8,100}"))throw unavailable();
      return new Checkout(tracker,checkoutUrl(tracker,source));
    } catch(RestClientException failure){throw unavailable();}
  }
  public Checkout reopen(String tracker,String source){requireEnabled();try{return new Checkout(tracker,checkoutUrl(tracker,source));}catch(RestClientException error){throw unavailable();}}
  private String checkoutUrl(String tracker,String source){
      JsonNode passport=http.post().uri("/client/passport/v1/token").body(Map.of()).retrieve().body(JsonNode.class);
      String tbt=passport==null?"":passport.path("data").asText("");
      if(tbt.isBlank() || tbt.length()>8192)throw unavailable();
      Map<String,String> query=new LinkedHashMap<>();query.put("environment","sandbox");query.put("tracker",tracker);
      query.put("tbt",tbt);query.put("source",source.equals("mobile")?"mobile":"hosted");
      query.put("redirect_url",returnUrl);query.put("cancel_url",returnUrl);
      String url=HOST+"/embedded/?"+query.entrySet().stream().map(e->encode(e.getKey())+"="+encode(e.getValue())).collect(java.util.stream.Collectors.joining("&"));
      return url;
  }
  public String state(String tracker,String expectedMerchant,long amount) {
    requireEnabled();
    try {
      JsonNode response=http.get().uri("/reporter/api/v1/payments/{tracker}",tracker).retrieve().body(JsonNode.class);
      if(response==null)throw unavailable();
      JsonNode data=response.path("data");JsonNode payment=data.has("tracker")?data.path("tracker"):data;
      JsonNode client=payment.path("client");String owner=client.isTextual()?client.asText():client.path("api_key").asText("");
      JsonNode total=payment.path("purchase_totals").path("quote_amount");
      String minor=total.path("amount").asText("");
      if(!tracker.equals(payment.path("token").asText()) || !"sandbox".equals(payment.path("environment").asText())
          || !expectedMerchant.equals(owner) || !"PKR".equals(total.path("currency").asText())
          || !minor.matches("[0-9]{1,18}") || new BigDecimal(minor).compareTo(BigDecimal.valueOf(amount))!=0)
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Safepay verification did not match this checkout. Do not pay again; contact ShopMart.");
      String state=payment.path("state").asText("");if(state.isBlank())throw unavailable();return state;
    } catch(RestClientException failure){throw unavailable();}
  }
  public void requireEnabled(){if(!enabled)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Safepay sandbox is not enabled on the backend yet.");}
  private static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
  private static ResponseStatusException unavailable(){return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Safepay could not confirm this request. Retry the same checkout; do not start a second payment.");}
}
