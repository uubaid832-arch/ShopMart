package com.shopmart.api.catalog;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProductImageStorageTests {
  @TempDir Path directory;
  JdbcTemplate jdbc;
  CloudinaryImageStore cloud;
  ProductImageService images;
  UUID admin = UUID.randomUUID();
  UUID product = UUID.randomUUID();

  @SuppressWarnings({"rawtypes", "unchecked"})
  @BeforeEach void setup() {
    jdbc = mock(JdbcTemplate.class);
    cloud = mock(CloudinaryImageStore.class);
    when(cloud.enabled()).thenReturn(true);
    when(cloud.url(any())).thenAnswer(call -> "https://res.cloudinary.com/testcloud/image/upload/shopmart/products/" + call.getArgument(0) + ".jpg");
    when(jdbc.queryForObject(anyString(), eq(Boolean.class), any(UUID.class))).thenReturn(true);
    when(jdbc.queryForList(startsWith("SELECT id FROM public.products"), any(UUID.class)))
        .thenReturn(List.of(Map.of("id", product)));
    when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class))).thenReturn(List.of());
    images = new ProductImageService(jdbc, directory.toString(), cloud);
    TransactionSynchronizationManager.initSynchronization();
  }

  @AfterEach void cleanup() { TransactionSynchronizationManager.clearSynchronization(); }

  MockMultipartFile png() throws Exception {
    BufferedImage input = new BufferedImage(2000, 100, BufferedImage.TYPE_INT_ARGB);
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    ImageIO.write(input, "png", output);
    input.flush();
    return new MockMultipartFile("files", "transparent.png", "image/png", output.toByteArray());
  }

  @Test void cloudUploadsStillNormalizeAndResizeImages() throws Exception {
    images.upload(admin, product, List.of(png()));
    ArgumentCaptor<byte[]> bytes = ArgumentCaptor.forClass(byte[].class);
    verify(cloud).upload(any(UUID.class), bytes.capture());
    BufferedImage jpeg = ImageIO.read(new ByteArrayInputStream(bytes.getValue()));
    assertNotNull(jpeg);
    assertEquals(1600, jpeg.getWidth());
    assertFalse(jpeg.getColorModel().hasAlpha());
    assertEquals(0xFFFFFF, jpeg.getRGB(0, 0) & 0xFFFFFF);
    jpeg.flush();
    try (var entries = Files.list(directory)) { assertEquals(0, entries.count()); }
  }

  @Test void rollbackRemovesNewCloudAsset() throws Exception {
    images.upload(admin, product, List.of(png()));
    ArgumentCaptor<UUID> id = ArgumentCaptor.forClass(UUID.class);
    verify(cloud).upload(id.capture(), any(byte[].class));
    verify(cloud, never()).delete(any());
    TransactionSynchronizationManager.getSynchronizations().forEach(
        sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
    verify(cloud).delete(id.getValue());
  }

  @Test void deletionWaitsForCommit() {
    UUID id = UUID.randomUUID();
    when(jdbc.update(contains("DELETE FROM public.product_images"), eq(id), eq(product))).thenReturn(1);
    images.delete(admin, product, id);
    verify(cloud, never()).delete(any());
    TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
    verify(cloud).delete(id);
  }

  @Test void rolledBackDeletionKeepsCloudAsset() {
    UUID id = UUID.randomUUID();
    when(jdbc.update(contains("DELETE FROM public.product_images"), eq(id), eq(product))).thenReturn(1);
    images.delete(admin, product, id);
    TransactionSynchronizationManager.getSynchronizations().forEach(
        sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
    verify(cloud, never()).delete(any());
  }

  @Test void localModeWritesLocalFileAndRollbackCleansIt() throws Exception {
    when(cloud.enabled()).thenReturn(false);
    images.upload(admin, product, List.of(png()));
    try (var entries = Files.list(directory)) { assertEquals(1, entries.count()); }
    verify(cloud, never()).upload(any(), any());
    TransactionSynchronizationManager.getSynchronizations().forEach(
        sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
    try (var entries = Files.list(directory)) { assertEquals(0, entries.count()); }
  }

  @Test void invalidImageIsRejectedBeforeCloudUpload() {
    var error = assertThrows(ResponseStatusException.class, () -> images.upload(admin, product,
        List.of(new MockMultipartFile("files", "bad.jpg", "image/jpeg", new byte[]{1, 2, 3}))));
    assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    verify(cloud, never()).upload(any(), any());
  }

  @Test void sixImageLimitStillApplies() throws Exception {
    var file = png();
    assertThrows(ResponseStatusException.class,
        () -> images.upload(admin, product, java.util.Collections.nCopies(7, file)));
    verify(cloud, never()).upload(any(), any());
  }

  @Test void legacyImageUrlOnlyRedirectsForAnExistingDatabaseImage() {
    UUID id = UUID.randomUUID();
    assertTrue(images.cloudUrl(id).endsWith(id + ".jpg"));
    when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(id))).thenReturn(false);
    var error = assertThrows(ResponseStatusException.class, () -> images.cloudUrl(id));
    assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
  }
}
