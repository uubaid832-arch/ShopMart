package com.shopmart.api.admin;

import java.util.UUID;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DataIntegrityViolationException;

@Service
public class AdminCategoryService {

  private final JdbcTemplate jdbc;

  public AdminCategoryService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }


  @Transactional(readOnly = true)
  public List<CategoryWithCount> listWithCounts(UUID adminId, String q) {
    requireAdmin(adminId);
    String search = q == null ? "" : q.strip();
    if (search.length() > 100) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search text is too long.");
    }
    return jdbc.query("""
        SELECT c.id, c.name, COUNT(p.id) AS product_count
        FROM public.categories c
        LEFT JOIN public.products p ON p.category_id=c.id
        WHERE c.name ILIKE ?
        GROUP BY c.id, c.name
        ORDER BY c.name
        """, (rs, row) -> new CategoryWithCount(
          rs.getObject("id", UUID.class), rs.getString("name"), rs.getLong("product_count")),
          "%" + search + "%");
  }

  public record CategoryWithCount(UUID id, String name, long productCount) {}

  @Transactional
  public CategoryResponse create(UUID adminId, CategoryRequest request) {
    requireAdmin(adminId);

    UUID id = UUID.randomUUID();
    String name = cleanName(request.name());

    try {
      jdbc.update("""
          INSERT INTO public.categories (id, name)
          VALUES (?, ?)
          """, id, name);
    } catch (DuplicateKeyException exception) {
      throw duplicateName();
    }

    return new CategoryResponse(id, name);
  }

  @Transactional
  public CategoryResponse update(
      UUID adminId, UUID id, CategoryRequest request) {
    requireAdmin(adminId);

    String name = cleanName(request.name());
    int updated;

    try {
      updated = jdbc.update("""
          UPDATE public.categories
          SET name = ?
          WHERE id = ?
          """, name, id);
    } catch (DuplicateKeyException exception) {
      throw duplicateName();
    }

    if (updated == 0) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Category not found.");
    }

    return new CategoryResponse(id, name);
  }

  @Transactional
  public void delete(UUID adminId, UUID id) {
    requireAdmin(adminId);

    var categories = jdbc.queryForList("""
        SELECT id
        FROM public.categories
        WHERE id = ?
        FOR UPDATE
        """, id);

    if (categories.isEmpty()) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "Category not found.");
    }

    Boolean used = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1
            FROM public.products
            WHERE category_id = ?
        )
        """, Boolean.class, id);

    if (Boolean.TRUE.equals(used)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "Move or remove this category's products before deleting it.");
    }

    try {
      jdbc.update("""
          DELETE FROM public.categories
          WHERE id = ?
          """, id);
    } catch (DataIntegrityViolationException exception) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "This category has linked records and cannot be deleted.");
    }
  }

  private void requireAdmin(UUID userId) {
    Boolean allowed = jdbc.queryForObject("""
        SELECT EXISTS (
            SELECT 1 FROM public.users
            WHERE id = ? AND enabled = TRUE AND role = 'ADMIN'
        )
        """, Boolean.class, userId);

    if (!Boolean.TRUE.equals(allowed)) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN,
          "Administrator access is required.");
    }
  }

  private static String cleanName(String value) {
    String name = value.strip();

    if (name.isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Please enter a category name.");
    }

    return name;
  }

  private static ResponseStatusException duplicateName() {
    return new ResponseStatusException(
        HttpStatus.CONFLICT,
        "A category with this name already exists.");
  }

  public record CategoryRequest(
      @NotBlank @Size(max = 80) String name) {
  }

  public record CategoryResponse(UUID id, String name) {
  }
}