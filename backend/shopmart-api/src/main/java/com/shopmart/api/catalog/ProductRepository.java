package com.shopmart.api.catalog;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, UUID> {

  @EntityGraph(attributePaths = "category")
  Page<Product> findByActiveTrue(Pageable pageable);

  @EntityGraph(attributePaths = "category")
  Optional<Product> findByIdAndActiveTrue(UUID id);
}