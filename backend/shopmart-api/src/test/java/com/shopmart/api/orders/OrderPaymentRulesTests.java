package com.shopmart.api.orders;

import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OrderPaymentRulesTests {

  @Test
  void safepayOrdersRemainManageableAfterPartialRefund() {
    assertTrue(OrderPaymentRules.supportsDelivery(Map.of(
        "payment_method", "DEMO",
        "payment_status", "DEMO_PAID")));
    assertTrue(OrderPaymentRules.supportsDelivery(Map.of(
        "payment_method", "DEMO",
        "payment_status", "PARTIALLY_REFUNDED")));
    assertFalse(OrderPaymentRules.supportsDelivery(Map.of(
        "payment_method", "DEMO",
        "payment_status", "REFUNDED")));
  }

  @Test
  void codWorkflowRemainsManageable() {
    assertTrue(OrderPaymentRules.supportsDelivery(Map.of(
        "payment_method", "COD",
        "payment_status", "UNPAID")));
  }
}