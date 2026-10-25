package com.shopmart.api.vouchers;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class VoucherMathTests {
 private BigDecimal n(String value){return new BigDecimal(value);}
 @Test void fixedAmountAndPercentageCapUseExactPaisa(){
  var fixed=VoucherMath.calculate("FIXED",n("100.00"),null,List.of(n("1000.00"),n("500.00")));
  assertEquals(n("100.00"),fixed.discount());assertEquals(n("66.67"),fixed.lineDiscounts().get(0));assertEquals(n("33.33"),fixed.lineDiscounts().get(1));
  var percent=VoucherMath.calculate("PERCENT",n("10.00"),n("120.00"),List.of(n("1000.00"),n("500.00")));
  assertEquals(n("120.00"),percent.discount());
 }
 @Test void discountCannotCreateFreeOrNegativeOrders(){
  assertThrows(VoucherService.Rejected.class,()->VoucherMath.calculate("FIXED",n("500"),null,List.of(n("500.00"))));
  assertThrows(VoucherService.Rejected.class,()->VoucherMath.calculate("PERCENT",n("1"),null,List.of(n("0.01"))));
 }
 @Test void allocatedRefundsAlwaysSumToPaidSubtotalAndEveryLineRemainsPositive(){
  Random random=new Random(83);
  for(int test=0;test<1000;test++){
   List<BigDecimal> gross=new ArrayList<>();for(int i=0,count=1+random.nextInt(50);i<count;i++)gross.add(BigDecimal.valueOf(1+random.nextInt(500000),2));
   var amounts=VoucherMath.calculate("PERCENT",BigDecimal.valueOf(1+random.nextInt(99)),null,gross);
   BigDecimal allocated=amounts.lineDiscounts().stream().reduce(BigDecimal.ZERO,BigDecimal::add);assertEquals(0,allocated.compareTo(amounts.discount()));
   BigDecimal refunds=BigDecimal.ZERO;
   for(int i=0;i<gross.size();i++){assertTrue(amounts.lineDiscounts().get(i).signum()>=0);BigDecimal net=gross.get(i).subtract(amounts.lineDiscounts().get(i));assertTrue(net.signum()>0);refunds=refunds.add(net);}
   assertEquals(0,refunds.compareTo(amounts.subtotal().subtract(amounts.discount())));
  }
 }
}
