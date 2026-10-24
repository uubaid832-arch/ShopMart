package com.shopmart.api.orders;

import java.util.Map;

public final class OrderPaymentRules {

  private OrderPaymentRules() {
  }

  public static boolean supportsDelivery(Map<String, Object> order) {
    return ("COD".equals(order.get("payment_method"))
        && "UNPAID".equals(order.get("payment_status")))
        || ("DEMO".equals(order.get("payment_method"))
            && "DEMO_PAID".equals(order.get("payment_status")));
  }
}