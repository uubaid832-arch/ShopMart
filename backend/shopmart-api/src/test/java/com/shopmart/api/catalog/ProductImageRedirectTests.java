package com.shopmart.api.catalog;

import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductImageRedirectTests {
  @Test void cloudModeRedirectsLegacyImageRequests() {
    ProductImageService service = mock(ProductImageService.class);
    UUID id = UUID.randomUUID();
    String url = "https://res.cloudinary.com/testcloud/image/upload/shopmart/products/" + id + ".jpg";
    when(service.cloudUrl(id)).thenReturn(url);
    var response = new ProductImageController(service).file(id);
    assertEquals(HttpStatus.FOUND, response.getStatusCode());
    assertEquals(URI.create(url), response.getHeaders().getLocation());
    verify(service, never()).file(any());
  }

  @Test void localModeKeepsJpegResponse() {
    ProductImageService service = mock(ProductImageService.class);
    UUID id = UUID.randomUUID();
    when(service.cloudUrl(id)).thenReturn(null);
    var resource = new ByteArrayResource(new byte[]{1, 2});
    when(service.file(id)).thenReturn(resource);
    var response = new ProductImageController(service).file(id);
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertEquals(MediaType.IMAGE_JPEG, response.getHeaders().getContentType());
    assertSame(resource, response.getBody());
  }
}
