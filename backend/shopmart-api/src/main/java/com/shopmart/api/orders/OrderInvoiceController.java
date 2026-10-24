package com.shopmart.api.orders;

import java.util.UUID;

import com.shopmart.api.admin.AdminOrderService;
import com.shopmart.api.orders.OrderModels.OrderReceipt;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class OrderInvoiceController {

  private final OrderService orders;
  private final AdminOrderService adminOrders;
  private final OrderInvoiceService invoices;

  public OrderInvoiceController(
      OrderService orders,
      AdminOrderService adminOrders,
      OrderInvoiceService invoices) {

    this.orders = orders;
    this.adminOrders = adminOrders;
    this.invoices = invoices;
  }

  @GetMapping(value = "/api/orders/{id}/invoice", produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> customerInvoice(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {

    // Existing order service checks customer ownership.
    OrderReceipt order = orders.getOrder(userId(jwt), id);
    return download(order);
  }

  @GetMapping(value = "/api/admin/orders/{id}/invoice", produces = MediaType.APPLICATION_PDF_VALUE)
  public ResponseEntity<byte[]> adminInvoice(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id) {

    // Existing admin service checks administrator access.
    OrderReceipt order = adminOrders.get(userId(jwt), id);
    return download(order);
  }

  private ResponseEntity<byte[]> download(OrderReceipt order) {
    String filename = "ShopMart-Invoice-" + order.id() + ".pdf";

    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_PDF)
        .cacheControl(CacheControl.noStore())
        .header("X-Content-Type-Options", "nosniff")
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment()
                .filename(filename)
                .build()
                .toString())
        .body(invoices.generate(order));
  }

  private static UUID userId(Jwt jwt) {
    if (jwt == null || jwt.getSubject() == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    try {
      return UUID.fromString(jwt.getSubject());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
  }
}