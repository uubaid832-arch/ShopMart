package com.shopmart.api.catalog;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@ConditionalOnProperty(name = "shopmart.cloudinary.migrate-local", havingValue = "true")
public class CloudinaryImageMigration implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(CloudinaryImageMigration.class);
  private final JdbcTemplate jdbc;
  private final CloudinaryImageStore cloudinary;
  private final Path directory;
  private final TransactionTemplate transactions;

  public CloudinaryImageMigration(JdbcTemplate jdbc, CloudinaryImageStore cloudinary,
      PlatformTransactionManager manager,
      @Value("${shopmart.upload-dir:./uploads/products}") String directory) {
    this.jdbc = jdbc;
    this.cloudinary = cloudinary;
    this.transactions = new TransactionTemplate(manager);
    this.directory = Path.of(directory).toAbsolutePath().normalize();
  }

  @Override
  public void run(ApplicationArguments arguments) {
    if (!cloudinary.enabled()) {
      throw new IllegalStateException("Enable Cloudinary before running the local image import.");
    }
    var ids = jdbc.query("SELECT id FROM public.product_images ORDER BY id",
        (rs, row) -> rs.getObject("id", UUID.class));
    int imported = 0;
    int missing = 0;
    for (UUID id : ids) {
      Boolean uploaded = transactions.execute(status -> {
        // Serialize against product image uploads/deletions while copying this image.
        var matches = jdbc.queryForList("""
            SELECT p.id FROM public.products p
            JOIN public.product_images i ON i.product_id = p.id
            WHERE i.id = ? FOR UPDATE OF p
            """, id);
        if (matches.isEmpty()) return false;
        Path file = directory.resolve(id + ".jpg");
        if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) return false;
        try {
          long size = Files.size(file);
          if (size < 1 || size > 5L * 1024 * 1024) {
            throw new IllegalStateException("A local image is empty or over 5 MB; check the uploads folder.");
          }
          cloudinary.upload(id, Files.readAllBytes(file));
          return true;
        } catch (IOException failure) {
          throw new IllegalStateException("Could not read local product image " + id + ".");
        }
      });
      if (Boolean.TRUE.equals(uploaded)) imported++;
      else missing++;
    }
    log.info("Cloudinary image import completed: {} copied/existing, {} without a local source file.", imported, missing);
    if (missing > 0) {
      log.warn("Images without a local source must already exist in Cloudinary or be re-uploaded through the admin portal.");
    }
    log.info("Keep SHOPMART_CLOUDINARY_ENABLED=true. Disable SHOPMART_CLOUDINARY_MIGRATE_LOCAL after this one-time import.");
  }
}
