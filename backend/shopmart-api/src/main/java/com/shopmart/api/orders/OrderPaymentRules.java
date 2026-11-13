package com.shopmart.api.orders;

import java.util.Map;

public final class OrderPaymentRules {

  private OrderPaymentRules() {
  }

  public static boolean supportsDelivery(Map<String, Object> order) {
    return ("COD".equals(order.get("payment_method"))
        && "UNPAID".equals(order.get("payment_status")))
        || ("DEMO".equals(order.get("payment_method"))
            && java.util.Set.of("DEMO_PAID", "PARTIALLY_REFUNDED")
                .contains(order.get("payment_status")))
        || ("BANK_TRANSFER".equals(order.get("payment_method"))
            && "PAID".equals(order.get("payment_status")));
  }
}
