ShopMart requested updates

Includes source changes for web, mobile, backend, and the SQL permission grant. No tables or columns are created.

Disabled account/voucher deletion
- Delete buttons appear only for disabled users and vouchers.
- Backend rejects deletion of admin accounts and records referenced by order, delivery, audit, or voucher redemption history.
- Migration 019_admin_delete_disabled.sql only grants DELETE permissions on existing users and vouchers tables to shopmart_app. Run it in Neon only if needed by that database role.

Bank transfer demonstration
- The demo details page uses a fictional account and the requested WhatsApp number 03263101049.
- The fake account cannot receive funds. This page does not create an order or update payment data. Do not transfer real money to it.

Animations
- Web: cart-added notice, wishlist heart, and order-success tick.
- Mobile: cart and wishlist pop plus order-success tick, using React Native Animated.

Validation
- Web lint and production build passed.
- Changed mobile JS/JSX parsed successfully.
- Backend build/tests were not verified here because Maven Central was unreachable.
