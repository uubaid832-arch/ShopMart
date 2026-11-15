package com.shopmart.api.catalog;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, UUID> {

  @EntityGraph(attributePaths = "category")
  Page<Product> findByActiveTrue(Pageable pageable);

  @EntityGraph(attributePaths = "category")
  @Query("""
      SELECT p FROM Product p JOIN p.category c
      WHERE p.active = true AND
        (lower(p.name) LIKE lower(concat('%', :q, '%'))
        OR lower(c.name) LIKE lower(concat('%', :q, '%'))
        OR lower(p.description) LIKE lower(concat('%', :q, '%')))
      """)
  Page<Product> searchActive(@Param("q") String q, Pageable pageable);

  @EntityGraph(attributePaths = "category")
  Optional<Product> findByIdAndActiveTrue(UUID id);

  @Query(value = """
      SELECT product_id AS "productId",
             CAST(AVG(rating) AS double precision) AS "averageRating",
             COUNT(*) AS "reviewCount"
      FROM public.product_reviews
      WHERE is_visible = TRUE AND product_id IN (:productIds)
      GROUP BY product_id
      """, nativeQuery = true)
  List<ProductReviewSummary> findVisibleReviewSummaries(@Param("productIds") List<UUID> productIds);

  interface ProductReviewSummary {
    UUID getProductId();
    Double getAverageRating();
    Long getReviewCount();
  }
}
