package com.shopmart.api.payments;

import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/webhooks/safepay")
public class SafepayRefundWebhookController {
  private final SafepayRefundWebhookService service;
  private final String secret;
  private final JsonMapper json=JsonMapper.builder().build();
  public SafepayRefundWebhookController(SafepayRefundWebhookService service,
      @Value("${SHOPMART_SAFEPAY_WEBHOOK_SECRET:}") String secret) {
    this.service=service;this.secret=secret.strip();
  }
  @PostMapping("/refunds")
  public ResponseEntity<Void> receive(@RequestHeader(value="X-SFPY-SIGNATURE",required=false) String signature,
      @RequestBody byte[] rawBody) {
    if(secret.isBlank() || !valid(rawBody,signature)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    try { service.accept(json.readTree(rawBody)); }
    catch(ResponseStatusException e){throw e;}
    catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid Safepay event.");}
    return ResponseEntity.ok().build();
  }
  private boolean valid(byte[] body,String signature){
    if(signature==null || !signature.matches("(?i)[0-9a-f]{64}"))return false;
    try {
      Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8),"HmacSHA256"));
      return MessageDigest.isEqual(mac.doFinal(body),HexFormat.of().parseHex(signature));
    } catch(Exception e){return false;}
  }
}
