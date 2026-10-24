package com.shopmart.api.catalog;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.AdditionalMatchers.aryEq;

class CloudinaryImageMigrationTests {
  @TempDir Path directory;
  JdbcTemplate jdbc;
  CloudinaryImageStore cloud;
  CloudinaryImageMigration migration;
  UUID id = UUID.randomUUID();

  @SuppressWarnings({"rawtypes", "unchecked"})
  @BeforeEach void setup() {
    jdbc = mock(JdbcTemplate.class);
    cloud = mock(CloudinaryImageStore.class);
    var manager = mock(PlatformTransactionManager.class);
    when(manager.getTransaction(any())).thenAnswer(call -> new SimpleTransactionStatus());
    when(cloud.enabled()).thenReturn(true);
    when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of(id));
    when(jdbc.queryForList(anyString(), eq(id))).thenReturn(List.of(Map.of("id", UUID.randomUUID())));
    migration = new CloudinaryImageMigration(jdbc, cloud, manager, directory.toString());
  }

  @Test void importsDatabaseLinkedImageWithoutDeletingOriginalFile() throws Exception {
    byte[] bytes = {1, 2, 3};
    Path file = directory.resolve(id + ".jpg");
    Files.write(file, bytes);
    migration.run(null);
    verify(cloud).upload(eq(id), aryEq(bytes));
    assertTrue(Files.exists(file));
    verify(jdbc, never()).update(anyString(), any(Object[].class));
  }

  @Test void missingLocalFileIsReportedWithoutUploading() {
    migration.run(null);
    verify(cloud, never()).upload(any(), any());
  }

  @Test void refusesImportWhenCloudStorageIsDisabled() {
    when(cloud.enabled()).thenReturn(false);
    assertThrows(IllegalStateException.class, () -> migration.run(null));
    verify(cloud, never()).upload(any(), any());
  }

  @Test void failedUploadKeepsLocalFileAndStopsStartupImport() throws Exception {
    Path file = directory.resolve(id + ".jpg");
    Files.write(file, new byte[]{1, 2, 3});
    doThrow(new IllegalStateException("test provider failure")).when(cloud).upload(eq(id), any());
    assertThrows(IllegalStateException.class, () -> migration.run(null));
    assertTrue(Files.exists(file));
  }
}
