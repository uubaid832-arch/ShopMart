package com.shopmart.api.catalog;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CloudinaryImageStore {
  private static final Logger log = LoggerFactory.getLogger(CloudinaryImageStore.class);
  private final boolean enabled;
  private final String cloud;
  private final String key;
  private final String secret;
  private final RestClient client;
  private final Clock clock;

  @Autowired
  public CloudinaryImageStore(
      @Value("${shopmart.cloudinary.enabled:false}") boolean enabled,
      @Value("${shopmart.cloudinary.cloud-name:}") String cloud,
      @Value("${shopmart.cloudinary.api-key:}") String key,
      @Value("${shopmart.cloudinary.api-secret:}") String secret) {
    this(enabled, cloud, key, secret, clientBuilder(cloud.strip()).build(), Clock.systemUTC());
  }

  CloudinaryImageStore(boolean enabled, String cloud, String key, String secret,
      RestClient client, Clock clock) {
    this.enabled = enabled;
    this.cloud = cloud.strip();
    this.key = key.strip();
    this.secret = secret.strip();
    this.client = client;
    this.clock = clock;
    if (enabled && (!this.cloud.matches("[A-Za-z0-9_-]+") || !this.key.matches("[0-9]+")
        || !this.secret.matches("[\\x21-\\x7E]+"))) {
      throw new IllegalArgumentException("Check the Cloudinary cloud name, numeric API key and API secret environment variables.");
    }
  }

  static RestClient.Builder clientBuilder(String cloud) {
    HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
    factory.setReadTimeout(Duration.ofSeconds(30));
    return RestClient.builder().requestFactory(factory)
        .baseUrl("https://api.cloudinary.com/v1_1/" + cloud + "/image");
  }

  public boolean enabled() { return enabled; }

  static String publicId(UUID id) { return "shopmart/products/" + id; }

  public String url(UUID id) {
    requireEnabled();
    return "https://res.cloudinary.com/" + cloud + "/image/upload/" + publicId(id) + ".jpg";
  }

  public void upload(UUID id, byte[] jpeg) {
    requireEnabled();
    if (jpeg == null || jpeg.length == 0 || jpeg.length > 5L * 1024 * 1024) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The normalized image must be between 1 byte and 5 MB.");
    }
    Map<String, String> params = Map.of("overwrite", "false", "public_id", publicId(id),
        "timestamp", Long.toString(clock.instant().getEpochSecond()));
    var form = new LinkedMultiValueMap<String, Object>();
    params.forEach(form::add);
    form.add("api_key", key);
    form.add("signature", signature(params, secret));
    ByteArrayResource resource = new ByteArrayResource(jpeg) {
      @Override public String getFilename() { return id + ".jpg"; }
    };
    HttpHeaders fileHeaders = new HttpHeaders();
    fileHeaders.setContentType(MediaType.IMAGE_JPEG);
    form.add("file", new HttpEntity<>(resource, fileHeaders));
    try {
      Map<?, ?> result = client.post().uri("/upload").contentType(MediaType.MULTIPART_FORM_DATA)
          .body(form).retrieve().body(Map.class);
      if (result == null || !publicId(id).equals(result.get("public_id"))
          || !safeUrl(result.get("secure_url"))) {
        throw unavailable();
      }
    } catch (RestClientException failure) {
      logStatus(failure);
      throw unavailable();
    }
  }

  public void delete(UUID id) {
    requireEnabled();
    Map<String, String> params = Map.of("invalidate", "true", "public_id", publicId(id),
        "timestamp", Long.toString(clock.instant().getEpochSecond()));
    var form = new LinkedMultiValueMap<String, String>();
    params.forEach(form::add);
    form.add("api_key", key);
    form.add("signature", signature(params, secret));
    try {
      Map<?, ?> result = client.post().uri("/destroy").contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .body(form).retrieve().body(Map.class);
      if (result == null || !("ok".equals(result.get("result")) || "not found".equals(result.get("result")))) {
        throw unavailable();
      }
    } catch (RestClientException failure) {
      logStatus(failure);
      throw unavailable();
    }
  }

  static String signature(Map<String, String> params, String secret) {
    String canonical = new TreeMap<>(params).entrySet().stream()
        .map(entry -> entry.getKey() + "=" + entry.getValue()).collect(Collectors.joining("&"));
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
          .digest((canonical + secret).getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException failure) {
      throw new IllegalStateException("SHA-256 is unavailable.", failure);
    }
  }

  private boolean safeUrl(Object value) {
    if (!(value instanceof String address)) return false;
    try {
      URI uri = URI.create(address);
      return "https".equals(uri.getScheme()) && "res.cloudinary.com".equals(uri.getHost())
          && uri.getPath().startsWith("/" + cloud + "/image/upload/");
    } catch (IllegalArgumentException failure) { return false; }
  }

  private void requireEnabled() {
    if (!enabled) throw new IllegalStateException("Cloudinary image storage is disabled.");
  }

  private static void logStatus(RestClientException failure) {
    if (failure instanceof RestClientResponseException response) {
      log.warn("Cloudinary image request failed with HTTP {}.", response.getStatusCode().value());
    } else {
      log.warn("Cloudinary image request could not be completed.");
    }
  }

  private static ResponseStatusException unavailable() {
    return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
        "Cloudinary image storage is temporarily unavailable. Check the backend configuration and try again.");
  }
}
