package com.shopmart.api.orders;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import com.shopmart.api.orders.OrderModels.OrderReceipt;

@Service
public class OrderInvoiceService {

  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM uuuu, HH:mm")
      .withLocale(Locale.ENGLISH)
      .withZone(ZoneId.of("Asia/Karachi"));

  public byte[] generate(OrderReceipt order) {
    try (
        PDDocument document = new PDDocument();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {

      boolean demo = "DEMO".equals(order.paymentMethod());
      boolean safepay = "SAFEPAY".equals(order.paymentProvider());

      boolean paidAndDelivered = !demo
          && "DELIVERED".equals(order.status())
          && "PAID".equals(order.paymentStatus());

      document.getDocumentInformation().setTitle(
          (demo && !safepay ? "ShopMart test order - " : "ShopMart invoice - ")
              + order.orderNumber());

      document.getDocumentInformation().setAuthor("ShopMart");

      try (InvoiceWriter writer = new InvoiceWriter(document, paidAndDelivered, demo, safepay)) {

        if (demo && !safepay) {
          writer.heading("TEST ORDER - NO MONEY CHARGED");
          writer.line(
              "This document records a simulated payment."
                  + " It is not proof of an actual payment.",
              true, 9);
          writer.space(12);
        }

        writer.heading("INVOICE DETAILS");
        writer.line("Invoice reference: INV-" + order.id(), false, 9);
        writer.line("Order number: " + order.orderNumber(), true, 10);

        writer.line(
            "Order date: " + DATE.format(order.createdAt()) + " PKT",
            false, 9);

        writer.line(
            "Generated: " + DATE.format(Instant.now()) + " PKT",
            false, 9);

        writer.line(
            "Order status: " + readable(order.status()),
            false, 9);

        writer.space(14);
        writer.heading("BILL TO / DELIVER TO");

        var delivery = order.delivery();

        writer.line(delivery.name(), true, 11);
        writer.line(delivery.address(), false, 10);
        writer.line(delivery.city(), false, 10);
        writer.line("Phone: " + delivery.phone(), false, 9);
        writer.line("Email: " + delivery.email(), false, 9);

        writer.space(18);
        writer.tableHeader();

        int number = 1;

        for (var item : order.items()) {
          BigDecimal unitPrice = new BigDecimal(item.price());
          BigDecimal lineTotal = unitPrice.multiply(
              BigDecimal.valueOf(item.quantity()));

          writer.tableRow(
              number++ + ". " + item.name(),
              item.quantity(),
              amount(unitPrice),
              amount(lineTotal));
        }

        writer.space(16);

        String paymentMethod = safepay
            ? "Safepay (Sandbox)"
            : demo
            ? "Demo payment"
            : "COD".equals(order.paymentMethod())
                ? "Cash on Delivery"
                : readable(order.paymentMethod());

        String paymentStatus = safepay
            ? "DEMO_PAID".equals(order.paymentStatus())
                ? "Paid via Safepay"
                : "DEMO_VOID".equals(order.paymentStatus())
                    ? "Cancelled - sandbox"
                    : readable(order.paymentStatus())
            : demo
            ? "DEMO_VOID".equals(order.paymentStatus())
                ? "Voided - no money charged"
                : "Simulated success - no money charged"
            : readable(order.paymentStatus());

        if (new BigDecimal(order.discountAmount()).signum() > 0) {
          writer.line("Product subtotal: " + amount(new BigDecimal(order.subtotal())), false, 10);
          writer.line("Voucher " + order.voucherCode() + ": -" + amount(new BigDecimal(order.discountAmount())), true, 10);
          writer.space(8);
        }
        writer.totalPanel(
            order.currency(),
            amount(new BigDecimal(order.total())),
            paymentMethod,
            paymentStatus);

        writer.space(18);

        if (safepay) {
          writer.line("Safepay sandbox transaction. No real money was charged.", false, 9);
        } else if (demo) {
          writer.line(
              "TEST ORDER ONLY - NO REAL PAYMENT",
              true, 10);

          writer.line(
              "No money was charged or collected."
                  + " This order is excluded from collected revenue.",
              false, 9);

          if ("CANCELLED".equals(order.status())) {
            writer.line(
                "The demo order was cancelled."
                    + " No monetary refund was required.",
                false, 9);
          } else if ("DELIVERED".equals(order.status())) {
            writer.line(
                "Delivery completed. No cash collection was required.",
                false, 9);
          }
        } else if (paidAndDelivered) {
          writer.line(
              "Payment recorded. Delivery completed.",
              true, 10);
        } else {
          writer.line(
              "This invoice does not by itself confirm payment.",
              true, 9);
        }

        writer.line(
            "Amounts use saved order prices. Status reflects the order "
                + "record at the time this document was generated.",
            false, 8);

        if (writer.usedCharacterEscapes()) {
          writer.space(5);
          writer.line(
              "Characters unavailable in the PDF font are shown "
                  + "as [U+XXXX] Unicode codes.",
              false, 8);
        }
      }

      document.save(output);
      return output.toByteArray();

    } catch (IOException exception) {
      throw new IllegalStateException(
          "Could not generate the invoice.", exception);
    }
  }

  private static String amount(BigDecimal value) {
    return String.format(
        Locale.ENGLISH,
        "%,.2f",
        value.setScale(2, RoundingMode.HALF_UP));
  }

  private static String readable(String value) {
    return value == null ? "" : value.replace('_', ' ');
  }

  private static final class InvoiceWriter implements AutoCloseable {

    private static final float LEFT = 44;
    private static final float RIGHT = PDRectangle.A4.getWidth() - 44;
    private static final float WIDTH = RIGHT - LEFT;

    private final PDDocument document;
    private final boolean paid;
    private final boolean demo;
    private final boolean safepay;

    private final PDFont regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

    private final PDFont bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    private PDPageContentStream stream;
    private float y;
    private int pageNumber;
    private boolean escapedCharacters;

    private InvoiceWriter(
        PDDocument document,
        boolean paid,
        boolean demo,
        boolean safepay) throws IOException {

      this.document = document;
      this.paid = paid;
      this.demo = demo;
      this.safepay = safepay;
      newPage();
    }

    private void newPage() throws IOException {
      if (stream != null) {
        stream.close();
      }

      PDPage page = new PDPage(PDRectangle.A4);
      document.addPage(page);

      stream = new PDPageContentStream(document, page);
      pageNumber++;

      float top = page.getMediaBox().getHeight();

      // Violet top border.
      fill(0.43f, 0.22f, 0.85f);
      stream.addRect(0, top - 9, page.getMediaBox().getWidth(), 9);
      stream.fill();

      // Violet logo badge.
      fill(0.49f, 0.23f, 0.93f);
      stream.addRect(LEFT, top - 65, 36, 36);
      stream.fill();

      drawCentered(
          "S", LEFT + 18, top - 55, bold, 25,
          1f, 1f, 1f);

      // Black "Shop" followed by violet "Mart".
      float brandX = LEFT + 45;

      drawText(
          "Shop", brandX, top - 55, bold, 27,
          0.05f, 0.05f, 0.07f);

      float shopWidth = bold.getStringWidth("Shop") * 27 / 1000f;

      drawText(
          "Mart", brandX + shopWidth, top - 55, bold, 27,
          0.49f, 0.23f, 0.93f);

      drawText(
          demo && !safepay ? "TEST ORDER RECORD" : "ORDER INVOICE",
          LEFT, top - 77, bold, 10,
          0.40f, 0.45f, 0.53f);

      if (safepay) {
        drawRight("SAFEPAY", RIGHT, top - 49, bold, 17, 0.49f, 0.23f, 0.93f);
        drawRight("SANDBOX", RIGHT, top - 68, bold, 8, 0.49f, 0.23f, 0.93f);
      } else if (demo) {
        drawRight(
            "TEST ORDER", RIGHT, top - 49, bold, 17,
            0.49f, 0.23f, 0.93f);

        drawRight(
            "NO MONEY CHARGED", RIGHT, top - 68, bold, 8,
            0.49f, 0.23f, 0.93f);
      } else if (paid) {
        paidStamp(RIGHT - 48, top - 66);
      } else {
        drawRight(
            "INVOICE", RIGHT, top - 55, bold, 20,
            0.18f, 0.23f, 0.31f);
      }

      rule(top - 116);
      y = top - 141;

      rule(43);

      drawText(
          safepay
              ? "ShopMart | Safepay sandbox invoice"
              : demo
              ? "ShopMart | Test order - no money charged"
              : "ShopMart | Order invoice",
          LEFT, 28, regular, 8,
          0.45f, 0.49f, 0.55f);

      drawRight(
          "Page " + pageNumber,
          RIGHT, 28, regular, 8,
          0.45f, 0.49f, 0.55f);
    }

    private void heading(String value) throws IOException {
      ensureSpace(30);

      drawText(
          value, LEFT, y, bold, 9,
          0.43f, 0.22f, 0.75f);

      y -= 19;
    }

    private void line(
        String value,
        boolean strong,
        float size) throws IOException {

      PDFont font = strong ? bold : regular;
      List<String> lines = wrap(value, font, size, WIDTH);

      for (String line : lines) {
        ensureSpace(size * 1.5f);

        drawText(
            line, LEFT, y, font, size,
            0.20f, 0.25f, 0.32f);

        y -= size * 1.5f;
      }
    }

    private void tableHeader() throws IOException {
      ensureSpace(35);

      fill(0.93f, 0.91f, 0.98f);
      stream.addRect(LEFT, y - 26, WIDTH, 26);
      stream.fill();

      drawText(
          "PRODUCT", LEFT + 10, y - 17, bold, 8,
          0.31f, 0.22f, 0.48f);

      drawRight(
          "QTY", 340, y - 17, bold, 8,
          0.31f, 0.22f, 0.48f);

      drawRight(
          "UNIT PRICE", 437, y - 17, bold, 8,
          0.31f, 0.22f, 0.48f);

      drawRight(
          "AMOUNT", RIGHT - 10, y - 17, bold, 8,
          0.31f, 0.22f, 0.48f);

      y -= 26;
    }

    private void tableRow(
        String name,
        int quantity,
        String unitPrice,
        String total) throws IOException {

      List<String> nameLines = wrap(name, regular, 9, 240);
      float height = Math.max(38, nameLines.size() * 14 + 18);

      if (y - height < 65) {
        newPage();
        tableHeader();
      }

      float baseline = y - 18;

      for (int index = 0; index < nameLines.size(); index++) {
        drawText(
            nameLines.get(index),
            LEFT + 10,
            baseline - index * 14,
            regular, 9,
            0.20f, 0.25f, 0.32f);
      }

      drawRight(
          Integer.toString(quantity),
          340, baseline, regular, 9,
          0.20f, 0.25f, 0.32f);

      drawRight(
          unitPrice,
          437, baseline, regular, 9,
          0.20f, 0.25f, 0.32f);

      drawRight(
          total,
          RIGHT - 10, baseline, bold, 9,
          0.20f, 0.25f, 0.32f);

      y -= height;
      rule(y);
    }

    private void totalPanel(
        String currency,
        String total,
        String paymentMethod,
        String paymentStatus) throws IOException {

      ensureSpace(115);

      fill(0.96f, 0.95f, 0.99f);
      stream.addRect(LEFT, y - 101, WIDTH, 101);
      stream.fill();

      drawText(
          "ORDER TOTAL (" + currency + ")",
          LEFT + 14, y - 23, bold, 10,
          0.31f, 0.22f, 0.48f);

      drawRight(
          total,
          RIGHT - 14, y - 25, bold, 20,
          0.35f, 0.18f, 0.70f);

      drawText(
          "Payment method: " + paymentMethod,
          LEFT + 14, y - 58, regular, 10,
          0.25f, 0.29f, 0.36f);

      drawText(
          "Payment status: " + paymentStatus,
          LEFT + 14, y - 80, bold, 10,
          paid ? 0.02f : 0.25f,
          paid ? 0.45f : 0.29f,
          paid ? 0.32f : 0.36f);

      y -= 101;
    }

    private void paidStamp(float cx, float cy) throws IOException {
      stream.saveGraphicsState();
      stream.setStrokingColor(0.02f, 0.50f, 0.36f);
      stream.setLineWidth(2);

      circle(cx, cy, 45);
      circle(cx, cy, 40);

      drawCentered(
          "SHOPMART", cx, cy + 18, bold, 8,
          0.02f, 0.45f, 0.32f);

      drawCentered(
          "PAID", cx, cy - 4, bold, 21,
          0.02f, 0.45f, 0.32f);

      drawCentered(
          "DELIVERED", cx, cy - 21, bold, 7,
          0.02f, 0.45f, 0.32f);

      stream.restoreGraphicsState();
    }

    private void circle(
        float cx,
        float cy,
        float radius) throws IOException {

      float k = radius * 0.55228475f;

      stream.moveTo(cx + radius, cy);

      stream.curveTo(
          cx + radius, cy + k,
          cx + k, cy + radius,
          cx, cy + radius);

      stream.curveTo(
          cx - k, cy + radius,
          cx - radius, cy + k,
          cx - radius, cy);

      stream.curveTo(
          cx - radius, cy - k,
          cx - k, cy - radius,
          cx, cy - radius);

      stream.curveTo(
          cx + k, cy - radius,
          cx + radius, cy - k,
          cx + radius, cy);

      stream.closePath();
      stream.stroke();
    }

    private void drawText(
        String value,
        float x,
        float baseline,
        PDFont font,
        float size,
        float red,
        float green,
        float blue) throws IOException {

      String safe = supportedText(value, font);

      stream.beginText();
      stream.setFont(font, size);
      stream.setNonStrokingColor(red, green, blue);
      stream.newLineAtOffset(x, baseline);
      stream.showText(safe);
      stream.endText();
    }

    private void drawRight(
        String value,
        float right,
        float baseline,
        PDFont font,
        float size,
        float red,
        float green,
        float blue) throws IOException {

      String safe = supportedText(value, font);
      float width = font.getStringWidth(safe) * size / 1000f;

      drawText(
          safe, right - width, baseline,
          font, size, red, green, blue);
    }

    private void drawCentered(
        String value,
        float center,
        float baseline,
        PDFont font,
        float size,
        float red,
        float green,
        float blue) throws IOException {

      String safe = supportedText(value, font);
      float width = font.getStringWidth(safe) * size / 1000f;

      drawText(
          safe, center - width / 2, baseline,
          font, size, red, green, blue);
    }

    private List<String> wrap(
        String value,
        PDFont font,
        float size,
        float maxWidth) throws IOException {

      String safe = supportedText(value, font);
      List<String> lines = new ArrayList<>();
      String remaining = safe.trim();

      while (!remaining.isEmpty()) {
        int end = 0;

        while (end < remaining.length()
            && font.getStringWidth(remaining.substring(0, end + 1))
                * size / 1000f <= maxWidth) {
          end++;
        }

        if (end == remaining.length()) {
          lines.add(remaining);
          break;
        }

        end = Math.max(1, end);
        int space = remaining.lastIndexOf(' ', end - 1);

        if (space > 0) {
          end = space;
        }

        lines.add(remaining.substring(0, end).trim());
        remaining = remaining.substring(end).trim();
      }

      if (lines.isEmpty()) {
        lines.add("");
      }

      return lines;
    }

    private String supportedText(
        String value,
        PDFont font) throws IOException {

      if (value == null) {
        return "";
      }

      StringBuilder result = new StringBuilder();

      for (int offset = 0; offset < value.length();) {
        int codePoint = value.codePointAt(offset);
        offset += Character.charCount(codePoint);

        if (Character.isWhitespace(codePoint)
            || Character.isISOControl(codePoint)) {
          result.append(' ');
          continue;
        }

        String character = new String(Character.toChars(codePoint));

        try {
          font.getStringWidth(character);
          result.append(character);
        } catch (IllegalArgumentException exception) {
          escapedCharacters = true;

          result.append("[U+")
              .append(Integer.toHexString(codePoint)
                  .toUpperCase(Locale.ROOT))
              .append(']');
        }
      }

      return result.toString();
    }

    private void rule(float baseline) throws IOException {
      stream.setStrokingColor(0.83f, 0.85f, 0.89f);
      stream.setLineWidth(0.6f);
      stream.moveTo(LEFT, baseline);
      stream.lineTo(RIGHT, baseline);
      stream.stroke();
    }

    private void fill(
        float red,
        float green,
        float blue) throws IOException {
      stream.setNonStrokingColor(red, green, blue);
    }

    private void ensureSpace(float height) throws IOException {
      if (y - height < 65) {
        newPage();
      }
    }

    private void space(float height) throws IOException {
      ensureSpace(height);
      y -= height;
    }

    private boolean usedCharacterEscapes() {
      return escapedCharacters;
    }

    @Override
    public void close() throws IOException {
      if (stream != null) {
        stream.close();
      }
    }
  }
}