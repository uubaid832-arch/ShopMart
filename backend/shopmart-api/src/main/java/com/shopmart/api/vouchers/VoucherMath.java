package com.shopmart.api.vouchers;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

public final class VoucherMath {
  private VoucherMath() {}
  public record Amounts(BigDecimal subtotal, BigDecimal discount, List<BigDecimal> lineDiscounts) {}
  // Largest-remainder distribution in whole paisa keeps refunds equal to what was paid.
  public static Amounts calculate(String kind, BigDecimal value, BigDecimal maximum, List<BigDecimal> gross) {
    BigDecimal subtotal=gross.stream().reduce(BigDecimal.ZERO,BigDecimal::add).setScale(2,RoundingMode.UNNECESSARY);
    BigDecimal discount="PERCENT".equals(kind)
        ?subtotal.multiply(value).divide(new BigDecimal("100"),2,RoundingMode.DOWN):value.setScale(2,RoundingMode.UNNECESSARY);
    if(maximum!=null) discount=discount.min(maximum);
    if(discount.compareTo(subtotal)>=0) throw new VoucherService.Rejected("This voucher requires a cart total greater than its discount.");
    long total=subtotal.movePointRight(2).longValueExact();
    long capacity=total-gross.size();
    long cents=Math.min(discount.movePointRight(2).longValueExact(),capacity);
    if(cents<=0) throw new VoucherService.Rejected("This cart is too small to receive a voucher discount.");
    long[] assigned=new long[gross.size()];BigDecimal[] fractions=new BigDecimal[gross.size()];long remaining=cents;
    for(int i=0;i<gross.size();i++) {
      BigDecimal exact=BigDecimal.valueOf(cents).multiply(gross.get(i).movePointRight(2)).divide(BigDecimal.valueOf(total),20,RoundingMode.DOWN);
      long cap=gross.get(i).movePointRight(2).longValueExact()-1;
      assigned[i]=Math.min(exact.longValue(),cap);fractions[i]=exact.subtract(BigDecimal.valueOf(assigned[i]));remaining-=assigned[i];
    }
    // At most a few passes for normal baskets; jump over filled lines.
    while(remaining>0) {
      int best=-1;
      for(int i=0;i<gross.size();i++) if(assigned[i]<gross.get(i).movePointRight(2).longValueExact()-1 && (best<0||fractions[i].compareTo(fractions[best])>0)) best=i;
      if(best<0)throw new IllegalStateException("Cannot allocate voucher discount.");
      assigned[best]++;fractions[best]=fractions[best].subtract(BigDecimal.ONE);remaining--;
    }
    List<BigDecimal> lines=new ArrayList<>();for(long item:assigned)lines.add(BigDecimal.valueOf(item,2));
    return new Amounts(subtotal,BigDecimal.valueOf(cents,2),List.copyOf(lines));
  }
}
