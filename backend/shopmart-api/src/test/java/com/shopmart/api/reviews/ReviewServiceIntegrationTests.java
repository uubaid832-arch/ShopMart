package com.shopmart.api.reviews;

import java.util.List;
import java.util.UUID;

import com.shopmart.api.admin.AdminOrderService;
import com.shopmart.api.delivery.DeliveryService;
import com.shopmart.api.delivery.RiderDeliveryService;
import com.shopmart.api.orders.OrderModels.CreateOrderRequest;
import com.shopmart.api.orders.OrderModels.ItemRequest;
import com.shopmart.api.orders.OrderService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class ReviewServiceIntegrationTests {

  @Autowired
  private ReviewService reviews;

  @Autowired
  private OrderService orders;

  @Autowired
  private AdminOrderService adminOrders;

  @Autowired
  private DeliveryService deliveries;

  @Autowired
  private RiderDeliveryService riderDeliveries;

  @Autowired
  private JdbcTemplate jdbc;

  private UUID admin;
  private UUID customer;
  private UUID otherCustomer;
  private UUID rider;
  private UUID product;
  private UUID order;

  @BeforeEach
  void setUp() {
    admin = createUser("ADMIN");
    customer = createUser("CUSTOMER");
    otherCustomer = createUser("CUSTOMER");
    rider = createUser("RIDER");

    UUID category = UUID.randomUUID();
    product = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.categories (id, name)
        VALUES (?, ?)
        """, category, "Review Test " + category);

    jdbc.update("""
        INSERT INTO public.products (
            id, category_id, name, price, currency,
            stock, active, illustration, color
        )
        VALUES (?, ?, 'Review Test Product', 1000,
                'PKR', 5, TRUE, 'headphones', 'lavender')
        """, product, category);

    order = orders.create(customer, new CreateOrderRequest(
        UUID.randomUUID(),
        "Review Test Customer",
        customer + "@example.com",
        "03000000000",
        "123 Test Street",
        "Lahore",
        "COD",
        List.of(new ItemRequest(product, 1)))).id();
  }

  @Test
  void customerCannotReviewBeforeDeliveryOrWithoutPurchase() {
    assertFalse(reviews.eligibility(customer, product).canReview());

    assertStatus(HttpStatus.CONFLICT,
        () -> reviews.create(customer, product, request()));

    deliverOrder();

    assertFalse(reviews.eligibility(otherCustomer, product).canReview());

    assertStatus(HttpStatus.CONFLICT,
        () -> reviews.create(otherCustomer, product, request()));

    assertEquals(0L, reviews.list(product, 0, 10).totalItems());
  }

  @Test
  void deliveredCustomerCanSubmitOnlyOneVerifiedReview() {
    deliverOrder();

    assertTrue(reviews.eligibility(customer, product).canReview());

    UUID id = reviews.create(customer, product, request());

    var page = reviews.list(product, 0, 10);
    var saved = page.items().get(0);

    assertEquals(1L, page.totalItems());
    assertEquals(id, saved.id());
    assertEquals(5, saved.rating());
    assertEquals("Very useful product.", saved.comment());
    assertTrue(saved.verifiedPurchase());
    assertEquals(5.0, page.averageRating(), 0.001);
    assertFalse(reviews.eligibility(customer, product).canReview());

    assertStatus(HttpStatus.CONFLICT,
        () -> reviews.create(customer, product, request()));

    assertEquals(1L, reviews.list(product, 0, 10).totalItems());
  }

  @Test
  void hiddenReviewIsExcludedFromPublicListAndAverage() {
    deliverOrder();
    UUID id = reviews.create(customer, product, request());

    jdbc.update("""
        UPDATE public.product_reviews
        SET is_visible = FALSE
        WHERE id = ?
        """, id);

    var page = reviews.list(product, 0, 10);

    assertEquals(0L, page.totalItems());
    assertTrue(page.items().isEmpty());
    assertEquals(0.0, page.averageRating(), 0.001);

    // Hiding a review must not allow duplicate submissions.
    assertFalse(reviews.eligibility(customer, product).canReview());
  }

  private ReviewService.ReviewRequest request() {
    return new ReviewService.ReviewRequest(5, "Very useful product.");
  }

  private void deliverOrder() {
    adminOrders.updateStatus(
        admin,
        order,
        new AdminOrderService.StatusRequest("CONFIRMED"));

    deliveries.assign(admin, order, rider);

    adminOrders.updateStatus(
        admin,
        order,
        new AdminOrderService.StatusRequest("DISPATCHED"));

    riderDeliveries.complete(rider, order);
  }

  private UUID createUser(String role) {
    UUID id = UUID.randomUUID();

    jdbc.update("""
        INSERT INTO public.users (
            id, name, email, password_hash, role
        )
        VALUES (?, ?, ?, 'unused-test-hash', ?)
        """,
        id,
        "Review Test User",
        id + "@example.com",
        role);

    return id;
  }

  private void assertStatus(
      HttpStatus expected,
      org.junit.jupiter.api.function.Executable action) {
    var error = assertThrows(ResponseStatusException.class, action);
    assertEquals(expected, error.getStatusCode());
  }
}