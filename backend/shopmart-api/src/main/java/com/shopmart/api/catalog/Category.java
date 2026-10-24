package com.shopmart.api.catalog;

import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "categories", schema = "public")
public class Category {

    @Id
    private UUID id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "parent_id")
    private UUID parentId;

    protected Category() {
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public UUID getParentId() {
        return parentId;
    }
}