package com.shopmart.api.catalog;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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
      @RequestParam(defaultValue = "12") int size,
      @RequestParam(required = false) String q) {
    if (page < 0 || size < 1 || size > 100) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Page must be non-negative and size must be between 1 and 100.");
    }

    String search = q == null ? "" : q.strip();
    if (search.length() > 100) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search text is too long.");
    }
    Page<Product> result = search.isEmpty()
      ? repository.findByActiveTrue(PageRequest.of(
          page, size, Sort.by("name").ascending().and(Sort.by("id"))))
      : repository.searchActive(search, PageRequest.of(
          page, size, Sort.by("name").ascending().and(Sort.by("id"))));

    List<Product> products = result.getContent();
    Map<UUID, ProductRepository.ProductReviewSummary> reviews = products.isEmpty()
        ? Map.of()
        : repository.findVisibleReviewSummaries(products.stream().map(Product::getId).toList())
            .stream().collect(Collectors.toMap(ProductRepository.ProductReviewSummary::getProductId, Function.identity()));

    return new ProductListResponse(
        products.stream()
            .map(product -> toResponse(product, reviews.get(product.getId())))
            .toList(),
        result.getNumber(),
        result.getSize(),
        result.getTotalElements(),
        result.getTotalPages());
  }

  @GetMapping("/{id}")
  public ProductResponse getProduct(@PathVariable UUID id) {
    return repository.findByIdAndActiveTrue(id)
        .map(product -> {
          List<ProductRepository.ProductReviewSummary> summaries = repository.findVisibleReviewSummaries(List.of(id));
          return toResponse(product, summaries.isEmpty() ? null : summaries.get(0));
        })
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Product not found."));
  }

  private static ProductResponse toResponse(Product product, ProductRepository.ProductReviewSummary reviews) {
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
        product.getColor(),
        reviews == null || reviews.getAverageRating() == null ? 0.0 : reviews.getAverageRating(),
        reviews == null || reviews.getReviewCount() == null ? 0L : reviews.getReviewCount());
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
      String color,
      double averageRating,
      long reviewCount) {
  }

  public record ProductListResponse(
      List<ProductResponse> items,
      int page,
      int size,
      long totalItems,
      int totalPages) {
  }
}
