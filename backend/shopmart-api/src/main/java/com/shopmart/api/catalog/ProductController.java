package com.shopmart.api.catalog;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/products")
public class ProductController {

  private final ProductRepository repository;

  public ProductController(ProductRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public ProductListResponse getProducts(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "12") int size) {
    if (page < 0 || size < 1 || size > 100) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Page must be non-negative and size must be between 1 and 100.");
    }

    Page<Product> result = repository.findByActiveTrue(
        PageRequest.of(
            page,
            size,
            Sort.by("name").ascending().and(Sort.by("id"))));

    return new ProductListResponse(
        result.getContent().stream()
            .map(ProductController::toResponse)
            .toList(),
        result.getNumber(),
        result.getSize(),
        result.getTotalElements(),
        result.getTotalPages());
  }

  @GetMapping("/{id}")
  public ProductResponse getProduct(@PathVariable UUID id) {
    return repository.findByIdAndActiveTrue(id)
        .map(ProductController::toResponse)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Product not found."));
  }

  private static ProductResponse toResponse(Product product) {
    Category category = product.getCategory();

    return new ProductResponse(
        product.getId(),
        product.getName(),
        product.getDescription(),
        new CategoryResponse(category.getId(), category.getName()),
        product.getPrice().toPlainString(),
        product.getCurrency(),
        product.getStock(),
        product.getIllustration(),
        product.getColor());
  }

  public record CategoryResponse(UUID id, String name) {
  }

  public record ProductResponse(
      UUID id,
      String name,
      String description,
      CategoryResponse category,
      String price,
      String currency,
      int stock,
      String illustration,
      String color) {
  }

  public record ProductListResponse(
      List<ProductResponse> items,
      int page,
      int size,
      long totalItems,
      int totalPages) {
  }
}