package com.shopmart.api.orders;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.stream.IntStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import com.shopmart.api.orders.OrderModels.*;
import static org.junit.jupiter.api.Assertions.*;

class OrderInvoiceServiceTests {
  private final OrderInvoiceService invoices = new OrderInvoiceService();
  private OrderReceipt order(String method, String payment, String status, String provider, int count) {
    var items = IntStream.range(0, count).mapToObj(i -> new OrderLine(UUID.randomUUID(),
        "Wireless Headphones " + (i + 1), "4500.00", 1)).toList();
    String total = (4500 * count) + ".00";
    return new OrderReceipt(UUID.fromString("00000000-0000-4000-8000-000000000001"),
        "SM-PREVIEW", status, method, payment, total, "PKR", Instant.parse("2026-10-26T10:00:00Z"), items,
        new DeliveryDetails("Sample Customer", "customer@example.invalid", "03001234567", "Sample delivery address", "Lahore"),
        total, "0.00", null, provider);
  }
  private String text(byte[] pdf) throws Exception {
    try (var document = Loader.loadPDF(pdf)) { return new PDFTextStripper().getText(document); }
  }
  @Test void verifiedSafepayInvoiceShowsProviderWithoutLegacyDemoLabels() throws Exception {
    byte[] pdf = invoices.generate(order("DEMO", "DEMO_PAID", "PENDING", "SAFEPAY", 2));
    String content = text(pdf);
    assertTrue(content.contains("Payment method: Safepay (Sandbox)"));
    assertTrue(content.contains("Payment status: Paid via Safepay"));
    assertTrue(content.contains("SANDBOX"));
    assertFalse(content.contains("Demo payment"));
    assertFalse(content.contains("TEST ORDER RECORD"));
    assertFalse(content.contains("Simulated success"));
    assertFalse(content.contains("DEMO_PAID"));
    String preview = System.getProperty("shopmart.invoice.preview");
    if (preview != null) { Path path=Path.of(preview); Files.createDirectories(path.getParent()); Files.write(path,pdf); }
  }
  @Test void legacyMockPaymentIsNotRelabelledAsSafepay() throws Exception {
    String content = text(invoices.generate(order("DEMO", "DEMO_PAID", "PENDING", null, 1)));
    assertTrue(content.contains("Demo payment"));
    assertTrue(content.contains("NO MONEY CHARGED"));
    assertFalse(content.contains("Paid via Safepay"));
  }
  @Test void unpaidCashOnDeliveryRemainsUnpaid() throws Exception {
    String content = text(invoices.generate(order("COD", "UNPAID", "PENDING", null, 1)));
    assertTrue(content.contains("Payment method: Cash on Delivery"));
    assertTrue(content.contains("Payment status: UNPAID"));
    assertFalse(content.contains("SANDBOX"));
  }
  @Test void deliveredPaidCodRetainsPaymentStamp() throws Exception {
    String content = text(invoices.generate(order("COD", "PAID", "DELIVERED", null, 1)));
    assertTrue(content.contains("DELIVERED"));
    assertTrue(content.contains("Payment recorded. Delivery completed."));
    assertFalse(content.contains("Safepay"));
  }
  @Test void cancelledSafepayOrderCannotClaimPaidStatus() throws Exception {
    String content = text(invoices.generate(order("DEMO", "DEMO_VOID", "CANCELLED", "SAFEPAY", 1)));
    assertTrue(content.contains("Payment status: Cancelled - sandbox"));
    assertFalse(content.contains("Paid via Safepay"));
  }
  @Test void multiPageSafepayInvoiceRetainsProviderAndTestMarker() throws Exception {
    byte[] pdf=invoices.generate(order("DEMO", "DEMO_PAID", "PENDING", "SAFEPAY", 50));
    try(var document=Loader.loadPDF(pdf)) {
      assertTrue(document.getNumberOfPages()>1);
      String content=new PDFTextStripper().getText(document);
      assertTrue(content.contains("Wireless Headphones 50"));
      assertTrue(content.contains("Paid via Safepay"));
      assertEquals(document.getNumberOfPages(), content.split("SANDBOX", -1).length-1);
    }
  }
}
