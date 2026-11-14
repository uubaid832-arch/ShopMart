ShopMart mobile and order-flow update

Included changes:
- Explicit admin-only DELETE security rules for disabled vouchers and users/riders on web and mobile APIs.
- Bank transfer checkout creates BANK_TRANSFER / PENDING orders after opening WhatsApp and tapping the explicit confirmation action. Demo account details are fictional; no payment or receipt is verified.
- Shorter new order numbers (SM- plus 16 UUID hex characters). Existing order numbers stay unchanged.
- Customer order actions: Track order only for PENDING/CONFIRMED/DISPATCHED; View order history for DELIVERED/RETURNED/CANCELLED; Return this order for DELIVERED orders. The return flow is filtered to the selected order. Internal return UUIDs remain database/API identifiers and are not displayed.
- Safepay order status displays as Paid via Safepay in customer and admin order views.
- More visible cart add and order success animations on web and mobile.

Neon SQL:
1. Run 019_admin_delete_disabled.sql if not already applied (grants DELETE on existing users/vouchers tables; creates no tables).
2. Run 020_bank_transfer_orders.sql to allow BANK_TRANSFER in the existing payment method constraint (no new table or column).

To diagnose the screenshot's unconfirmed bank transfer order, run this in Neon after applying 020:
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'orders_payment_method_valid'
  AND conrelid = 'public.orders'::regclass;

The returned definition must include BANK_TRANSFER. An unconfirmed HTTP 5xx may mean the DB migration is missing. Check My Orders before retrying; the checkout keeps the same idempotency request to prevent duplicate orders. If the constraint includes BANK_TRANSFER and the error continues, check Render logs for POST /api/orders at that time.

Validation:
- Web ESLint and production build passed.
- Edited mobile JavaScript files parsed with Babel's JSX parser. Expo lint was unavailable because this checkout has no local Expo executable/ESLint installation.
- Maven build/tests could not run because Maven Central was unreachable and the Spring Boot parent POM is not cached.
