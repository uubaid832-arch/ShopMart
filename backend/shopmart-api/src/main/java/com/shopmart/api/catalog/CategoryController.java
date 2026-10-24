package com.shopmart.api.catalog;

import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository repository;

    public CategoryController(CategoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public CategoryListResponse getCategories() {
        List<CategoryResponse> items = repository.findAllByOrderByNameAsc()
            .stream()
            .map(category -> new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getParentId()
            ))
            .toList();

        return new CategoryListResponse(items);
    }

    public record CategoryResponse(UUID id, String name, UUID parentId) {
    }

    public record CategoryListResponse(List<CategoryResponse> items) {
    }
}