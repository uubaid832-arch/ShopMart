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
import com.shopmart.api.vouchers.ProductDiscountService;

@RestController
@RequestMapping("/api/products")
public class ProductController {

  private final ProductRepository repository;
  private final ProductDiscountService discounts;

  public ProductController(ProductRepository repository, ProductDiscountService discounts) {
    this.repository = repository;
    this.discounts = discounts;
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

    List<Product> products = result.getContent();
    Map<UUID, ProductRepository.ProductReviewSummary> reviews = products.isEmpty()
        ? Map.of()
        : repository.findVisibleReviewSummaries(products.stream().map(Product::getId).toList())
            .stream().collect(Collectors.toMap(ProductRepository.ProductReviewSummary::getProductId, Function.identity()));
    Map<UUID, ProductDiscountService.Offer> offers = discounts.activeOffers(products.stream().map(Product::getId).toList());

    return new ProductListResponse(
        products.stream()
            .map(product -> toResponse(product, reviews.get(product.getId()), offers.get(product.getId())))
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
          return toResponse(product, summaries.isEmpty() ? null : summaries.get(0), discounts.activeOffers(List.of(id)).get(id));
        })
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Product not found."));
  }

  private static ProductResponse toResponse(Product product, ProductRepository.ProductReviewSummary reviews, ProductDiscountService.Offer offer) {
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
        reviews == null || reviews.getReviewCount() == null ? 0L : reviews.getReviewCount(),
        offer == null ? null : offer.discountedPrice(), offer == null ? null : offer.kind(),
        offer == null ? null : offer.value(), offer == null ? null : offer.discountAmount(),
        offer == null ? null : offer.campaignId(), offer == null ? null : offer.campaignName());
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
      long reviewCount,
      String discountedPrice,
      String discountKind,
      String discountValue,
      String discountAmount,
      String discountCampaignId,
      String discountCampaignName) {
  }

  public record ProductListResponse(
      List<ProductResponse> items,
      int page,
      int size,
      long totalItems,
      int totalPages) {
  }
}
