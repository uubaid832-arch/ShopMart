package com.shopmart.api.catalog;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class CloudinaryImageStoreTests {
  private final UUID id = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private final Clock clock = Clock.fixed(Instant.ofEpochSecond(1700000000), ZoneOffset.UTC);
  private CloudinaryImageStore store;
  private MockRestServiceServer server;

  @BeforeEach void setup() {
    var builder = CloudinaryImageStore.clientBuilder("testcloud");
    server = MockRestServiceServer.bindTo(builder).build();
    store = new CloudinaryImageStore(true, "testcloud", "123456", "test-secret", builder.build(), clock);
  }

  @Test void signsSortedParametersUsingSha256() {
    String actual = CloudinaryImageStore.signature(Map.of("timestamp", "1700000000",
        "public_id", CloudinaryImageStore.publicId(id), "overwrite", "false"), "test-secret");
    assertEquals("9951b3bec6388aaef5731865a3e0ed41095b8f9d7263a3bf03630b7ae34ab72d", actual);
  }

  @Test void uploadUsesSignedMultipartAndKeepsExistingUuid() {
    server.expect(requestTo("https://api.cloudinary.com/v1_1/testcloud/image/upload"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
        .andExpect(request -> {
          String body = ((MockClientHttpRequest) request).getBodyAsString(StandardCharsets.ISO_8859_1);
          assertTrue(body.contains("shopmart/products/" + id));
          assertTrue(body.contains("9951b3bec6388aaef5731865a3e0ed41095b8f9d7263a3bf03630b7ae34ab72d"));
          assertTrue(body.contains("name=\"file\""));
          assertTrue(body.contains("filename=\"" + id + ".jpg\""));
          assertFalse(body.contains("test-secret"));
        })
        .andRespond(withSuccess("""
            {"public_id":"shopmart/products/11111111-1111-1111-1111-111111111111",
             "secure_url":"https://res.cloudinary.com/testcloud/image/upload/v1/shopmart/products/11111111-1111-1111-1111-111111111111.jpg"}
            """, MediaType.APPLICATION_JSON));
    store.upload(id, new byte[]{1, 2, 3});
    server.verify();
    assertEquals("https://res.cloudinary.com/testcloud/image/upload/shopmart/products/" + id + ".jpg", store.url(id));
  }

  @Test void deleteUsesSignedFormAndInvalidatesCdn() {
    server.expect(requestTo("https://api.cloudinary.com/v1_1/testcloud/image/destroy"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
        .andExpect(request -> {
          String body = ((MockClientHttpRequest) request).getBodyAsString();
          assertTrue(body.contains("invalidate=true"));
          assertTrue(body.contains("public_id=shopmart%2Fproducts%2F" + id));
          assertTrue(body.contains("signature="));
          assertFalse(body.contains("test-secret"));
        })
        .andRespond(withSuccess("{\"result\":\"ok\"}", MediaType.APPLICATION_JSON));
    store.delete(id);
    server.verify();
  }

  @Test void deletingAnAlreadyAbsentAssetIsSafe() {
    server.expect(requestTo("https://api.cloudinary.com/v1_1/testcloud/image/destroy"))
        .andRespond(withSuccess("{\"result\":\"not found\"}", MediaType.APPLICATION_JSON));
    assertDoesNotThrow(() -> store.delete(id));
    server.verify();
  }

  @Test void providerFailureMapsToServiceUnavailableWithoutExposingCredentials() {
    server.expect(requestTo("https://api.cloudinary.com/v1_1/testcloud/image/upload"))
        .andRespond(withStatus(HttpStatus.UNAUTHORIZED));
    var error = assertThrows(ResponseStatusException.class, () -> store.upload(id, new byte[]{1}));
    assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
    assertFalse(error.toString().contains("test-secret"));
    server.verify();
  }

  @Test void rejectsUnexpectedUploadResponse() {
    server.expect(requestTo("https://api.cloudinary.com/v1_1/testcloud/image/upload"))
        .andRespond(withSuccess("{\"public_id\":\"wrong-id\",\"secure_url\":\"https://example.com/file.jpg\"}", MediaType.APPLICATION_JSON));
    assertThrows(ResponseStatusException.class, () -> store.upload(id, new byte[]{1}));
    server.verify();
  }

  @Test void refusesEmptyImageBeforeMakingRequest() {
    assertThrows(ResponseStatusException.class, () -> store.upload(id, new byte[0]));
    server.verify();
  }

  @Test void invalidCredentialsAreRejectedAtStartup() {
    assertThrows(IllegalArgumentException.class,
        () -> new CloudinaryImageStore(true, "testcloud", "not-a-numeric-key", "secret", null, clock));
    assertThrows(IllegalArgumentException.class,
        () -> new CloudinaryImageStore(true, "testcloud", "123456", "\u0016", null, clock));
  }

  @Test void localModeDoesNotRequireCloudCredentials() {
    var local = new CloudinaryImageStore(false, "", "", "", null, clock);
    assertFalse(local.enabled());
    assertThrows(IllegalStateException.class, () -> local.upload(id, new byte[]{1}));
  }
}
