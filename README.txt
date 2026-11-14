ShopMart bank transfer return fix

Copy the included files into the matching paths in the project. No new database migration is required. Bank transfer orders must already use the existing BANK_TRANSFER payment method and be marked PAID after receipt confirmation.

Flow: Customer requests return for a delivered, paid bank transfer order. Admin receives and inspects the returned goods, accepts the return, pays the customer manually, then records the receipt reference in the existing refund endpoint. ShopMart updates the return and order payment status. COD uses the same existing process and remains supported.

Safepay refunds remain a separate provider-refund action.
