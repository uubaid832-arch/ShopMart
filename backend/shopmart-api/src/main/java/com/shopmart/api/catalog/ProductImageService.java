package com.shopmart.api.catalog;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductImageService {

  private static final int MAX_IMAGES = 6;
  private static final long MAX_BYTES = 5L * 1024 * 1024;

  private static final Logger log = LoggerFactory.getLogger(ProductImageService.class);

  private final JdbcTemplate jdbc;
  private final Path directory;

  public ProductImageService(
      JdbcTemplate jdbc,
      @Value("${shopmart.upload-dir:./uploads/products}") String directory) {
    this.jdbc = jdbc;
    this.directory = Path.of(directory).toAbsolutePath().normalize();
  }

  @Transactional(readOnly = true)
  public List<ProductImage> catalog(List<UUID> productIds) {
    if (productIds == null
        || productIds.isEmpty()
        || productIds.size() > 100
        || productIds.stream().anyMatch(id -> id == null)) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "Request between 1 and 100 product IDs.");
    }

    String placeholders = String.join(
        ",", Collections.nCopies(productIds.size(), "?"));

    return jdbc.query("""
        SELECT i.id, i.product_id, i.position
        FROM public.product_images i
        JOIN public.products p ON p.id = i.product_id
        WHERE p.active = TRUE AND p.id IN (
        """ + placeholders + ") ORDER BY i.product_id, i.position, i.id",
        (rs, row) -> image(
            rs.getObject("id", UUID.class),
            rs.getObject("product_id", UUID.class),
            rs.getInt("position")),
        productIds.toArray());
  }

  @Transactional(readOnly = true)
  public List<ProductImage> list(UUID adminId, UUID productId) {
    requireAdmin(adminId);
    requireProduct(productId, false);

    return images(productId);
  }

  @Transactional
  public List<ProductImage> upload(
      UUID adminId,
      UUID productId,
      List<MultipartFile> files) {
    requireAdmin(adminId);
    requireProduct(productId, true);

    int count = images(productId).size();

    if (files == null
        || files.isEmpty()
        || files.size() > MAX_IMAGES - count) {
      throw failure(
          HttpStatus.BAD_REQUEST,
          "A product can have up to six images.");
    }

    for (MultipartFile file : files) {
      if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
        throw failure(
            HttpStatus.BAD_REQUEST,
            "Each image must be between 1 byte and 5 MB.");
      }
    }

    List<Path> created = new ArrayList<>();

    // Remove newly created files if the database transaction fails.
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCompletion(int status) {
            if (status != STATUS_COMMITTED) {
              created.forEach(ProductImageService.this::deleteQuietly);
            }
          }
        });

    try {
      Files.createDirectories(directory);

      for (MultipartFile file : files) {
        UUID id = UUID.randomUUID();
        BufferedImage normalized = decode(file);
        Path destination = filePath(id);

        try (OutputStream output = Files.newOutputStream(
            destination,
            StandardOpenOption.CREATE_NEW,
            StandardOpenOption.WRITE)) {
          created.add(destination);

          if (!ImageIO.write(normalized, "jpeg", output)) {
            throw new IOException("JPEG writer unavailable");
          }
        } finally {
          normalized.flush();
        }

        jdbc.update("""
            INSERT INTO public.product_images (
                id, product_id, position
            )
            VALUES (?, ?, ?)
            """, id, productId, count++);
      }
    } catch (IOException exception) {
      throw failure(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "Could not store the product images.");
    }

    return images(productId);
  }

  @Transactional
  public List<ProductImage> makePrimary(
      UUID adminId,
      UUID productId,
      UUID imageId) {
    requireAdmin(adminId);
    requireProduct(productId, true);

    List<ProductImage> ordered = new ArrayList<>(images(productId));

    ProductImage selected = ordered.stream()
        .filter(item -> item.id().equals(imageId))
        .findFirst()
        .orElseThrow(() -> failure(
            HttpStatus.NOT_FOUND,
            "Image not found."));

    ordered.remove(selected);
    ordered.add(0, selected);
    reorder(ordered);

    return images(productId);
  }

  @Transactional
  public List<ProductImage> delete(
      UUID adminId,
      UUID productId,
      UUID imageId) {
    requireAdmin(adminId);
    requireProduct(productId, true);

    int removed = jdbc.update("""
        DELETE FROM public.product_images
        WHERE id = ? AND product_id = ?
        """, imageId, productId);

    if (removed != 1) {
      throw failure(HttpStatus.NOT_FOUND, "Image not found.");
    }

    reorder(images(productId));

    // Delete the physical file only after the database change commits.
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            deleteQuietly(filePath(imageId));
          }
        });

    return images(productId);
  }

  /**
   * Called by AdminProductService inside its product deletion transaction.
   * Image rows roll back if product deletion fails.
   * Physical files are removed only after the transaction commits.
   */
  @Transactional(propagation = Propagation.MANDATORY)
  public void deleteAllForProduct(UUID adminId, UUID productId) {
    requireAdmin(adminId);
    requireProduct(productId, true);

    List<UUID> imageIds = jdbc.query("""
        SELECT id
        FROM public.product_images
        WHERE product_id = ?
        """,
        (rs, row) -> rs.getObject("id", UUID.class),
        productId);

    jdbc.update("""
        DELETE FROM public.product_images
        WHERE product_id = ?
        """, productId);

    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            imageIds.forEach(id -> deleteQuietly(filePath(id)));
          }
        });
  }

  @Transactional(readOnly = true)
  public Resource file(UUID imageId) {
    Boolean exists = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.product_images WHERE id = ?
        )
        """, Boolean.class, imageId);

    Path path = filePath(imageId);

    if (!Boolean.TRUE.equals(exists)
        || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
      throw failure(HttpStatus.NOT_FOUND, "Image not found.");
    }

    return new FileSystemResource(path);
  }

  private BufferedImage decode(MultipartFile file) throws IOException {
    try (
        InputStream raw = file.getInputStream();
        ImageInputStream input = new MemoryCacheImageInputStream(raw)) {

      var readers = ImageIO.getImageReaders(input);

      if (!readers.hasNext()) {
        throw failure(
            HttpStatus.BAD_REQUEST,
            "Select a valid JPEG or PNG image.");
      }

      ImageReader reader = readers.next();

      try {
        String format = reader.getFormatName().toLowerCase(Locale.ROOT);

        if (!List.of("jpeg", "jpg", "png").contains(format)) {
          throw failure(
              HttpStatus.BAD_REQUEST,
              "Only JPEG and PNG images are supported.");
        }

        reader.setInput(input, true, true);

        int width = reader.getWidth(0);
        int height = reader.getHeight(0);

        if (width < 1
            || height < 1
            || width > 6000
            || height > 6000
            || (long) width * height > 16_000_000) {
          throw failure(
              HttpStatus.BAD_REQUEST,
              "Use an image up to 6000 pixels per side and 16 megapixels.");
        }

        BufferedImage source = reader.read(0);

        if (source == null) {
          throw failure(HttpStatus.BAD_REQUEST, "Invalid image.");
        }

        double scale = Math.min(
            1, 1600.0 / Math.max(width, height));

        int targetWidth = Math.max(
            1, (int) Math.round(width * scale));

        int targetHeight = Math.max(
            1, (int) Math.round(height * scale));

        BufferedImage result = new BufferedImage(
            targetWidth,
            targetHeight,
            BufferedImage.TYPE_INT_RGB);

        Graphics2D graphics = result.createGraphics();

        try {
          graphics.setColor(Color.WHITE);
          graphics.fillRect(0, 0, targetWidth, targetHeight);

          graphics.setRenderingHint(
              RenderingHints.KEY_INTERPOLATION,
              RenderingHints.VALUE_INTERPOLATION_BICUBIC);

          graphics.drawImage(
              source, 0, 0, targetWidth, targetHeight, null);
        } finally {
          graphics.dispose();
          source.flush();
        }

        return result;
      } catch (javax.imageio.IIOException exception) {
        throw failure(
            HttpStatus.BAD_REQUEST,
            "This image could not be read. Try another JPEG or PNG.");
      } finally {
        reader.dispose();
      }
    }
  }

  private List<ProductImage> images(UUID productId) {
    return jdbc.query("""
        SELECT id, product_id, position
        FROM public.product_images
        WHERE product_id = ?
        ORDER BY position, id
        """,
        (rs, row) -> image(
            rs.getObject("id", UUID.class),
            rs.getObject("product_id", UUID.class),
            rs.getInt("position")),
        productId);
  }

  private void reorder(List<ProductImage> ordered) {
    for (int position = 0; position < ordered.size(); position++) {
      jdbc.update("""
          UPDATE public.product_images
          SET position = ?
          WHERE id = ?
          """, position, ordered.get(position).id());
    }
  }

  private void requireProduct(UUID id, boolean lock) {
    var products = jdbc.queryForList(
        "SELECT id FROM public.products WHERE id = ?"
            + (lock ? " FOR UPDATE" : ""),
        id);

    if (products.isEmpty()) {
      throw failure(HttpStatus.NOT_FOUND, "Product not found.");
    }
  }

  private void requireAdmin(UUID userId) {
    Boolean allowed = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = ? AND role = 'ADMIN' AND enabled = TRUE
        )
        """, Boolean.class, userId);

    if (!Boolean.TRUE.equals(allowed)) {
      throw failure(
          HttpStatus.FORBIDDEN,
          "Administrator access is required.");
    }
  }

  private Path filePath(UUID id) {
    return directory.resolve(id + ".jpg");
  }

  private void deleteQuietly(Path path) {
    try {
      Files.deleteIfExists(path);
    } catch (IOException exception) {
      log.warn(
          "Could not remove unused product image {}",
          path.getFileName());
    }
  }

  private static ProductImage image(
      UUID id, UUID productId, int position) {
    return new ProductImage(
        id,
        productId,
        "/api/product-images/files/" + id,
        position);
  }

  private static ResponseStatusException failure(
      HttpStatus status, String message) {
    return new ResponseStatusException(status, message);
  }

  public record ProductImage(
      UUID id,
      UUID productId,
      String url,
      int position) {
  }
}