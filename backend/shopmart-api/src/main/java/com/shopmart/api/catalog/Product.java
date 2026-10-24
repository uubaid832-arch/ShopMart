package com.shopmart.api.catalog;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "products", schema = "public")
public class Product {

  @Id
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "category_id", nullable = false)
  private Category category;

  private String name;

  private String description;

  @Column(precision = 12, scale = 2)
  private BigDecimal price;

  private String currency;

  private int stock;

  private boolean active;

  private String illustration;

  private String color;

  @Version
  private long version;

  protected Product() {
  }

  public UUID getId() {
    return id;
  }

  public Category getCategory() {
    return category;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public BigDecimal getPrice() {
    return price;
  }

  public String getCurrency() {
    return currency;
  }

  public int getStock() {
    return stock;
  }

  public String getIllustration() {
    return illustration;
  }

  public String getColor() {
    return color;
  }
}