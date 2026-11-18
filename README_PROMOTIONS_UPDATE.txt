ShopMart promotion and voucher update

This zip contains complete updated source files from the supplied ShopMart source snapshot. Copy the included apps/ and backend/ paths into the matching folders of your project, replacing those files. Review your local changes before overwriting newer work.

Included changes
- Campaign names are optional. Named active campaigns display as clickable promotion banners on web and mobile. Selecting a banner filters the catalog to products in that campaign. Unnamed campaign items display a clickable generic Sale label.
- Admins can edit campaign names, products, and discount rules in web and mobile admin. Included products are hidden by default and shown in a list when requested.
- Admins can delete a campaign only after disabling it. The delete removes the campaign and its discount rules; existing order totals remain stored.
- Admins can edit voucher code, type, value, minimum spend, cap, usage limits, and validity period on web and mobile. Existing usage limits cannot be reduced below prior redemptions.
- Campaign-discounted products remain excluded from voucher calculations.
- Adds a five-argument Quote constructor for existing tests/call sites, addressing the Render test-compilation error you provided.

Database
Run backend/shopmart-api/database/025_editable_discount_promotions.sql against the same Neon branch used by Render. Migration 024 (product discount campaigns) must already be applied because migration 025 alters its campaign table. Voucher editing requires no new database columns.

Commands in PowerShell from D:\PROJECT-FYP\ShopMart

1. Run the Neon migration in the SQL Editor first.
2. Copy files from the extracted zip to matching repository folders.
3. Verify the web app:
   cd D:\PROJECT-FYP\ShopMart\apps\web
   npm.cmd run lint
   npm.cmd run build
4. Run backend tests and package:
   cd D:\PROJECT-FYP\ShopMart\backend\shopmart-api
   .\mvnw.cmd -Dtest=VoucherApiTests,VoucherAdminServiceTests,VoucherServiceTests test
   .\mvnw.cmd -DskipTests package
5. Review and push:
   cd D:\PROJECT-FYP\ShopMart
   git diff --check
   git add apps/web/src/App.jsx apps/web/src/features/vouchers/AdminProductDiscounts.jsx apps/web/src/features/vouchers/AdminVouchers.jsx apps/mobile/App.js apps/mobile/src/admin/AdminVouchers.js apps/mobile/src/admin/ProductDiscountsModule.js backend/shopmart-api/database/025_editable_discount_promotions.sql backend/shopmart-api/src/main/java/com/shopmart/api/vouchers/AdminProductDiscountController.java backend/shopmart-api/src/main/java/com/shopmart/api/vouchers/AdminVoucherController.java backend/shopmart-api/src/main/java/com/shopmart/api/vouchers/AdminVoucherService.java backend/shopmart-api/src/main/java/com/shopmart/api/vouchers/ProductDiscountService.java backend/shopmart-api/src/main/java/com/shopmart/api/vouchers/VoucherService.java backend/shopmart-api/src/main/java/com/shopmart/api/security/SecurityConfig.java backend/shopmart-api/src/main/java/com/shopmart/api/security/MobileApiSecurityConfig.java backend/shopmart-api/src/test/java/com/shopmart/api/vouchers/VoucherAdminServiceTests.java backend/shopmart-api/src/test/java/com/shopmart/api/vouchers/VoucherApiTests.java backend/shopmart-api/src/test/java/com/shopmart/api/vouchers/VoucherServiceTests.java
   git diff --cached --check
   git commit -m "Add editable sale promotions and vouchers"
   git push origin main

Mobile app
After pushing, install dependencies if needed from apps/mobile with npm.cmd install, then use npm.cmd start to open Expo. Build a new APK after the code is deployed to your Git branch.

Validation performed here
- Web ESLint: passed.
- Web production build: passed; Vite emitted its existing large JavaScript chunk warning.
- Mobile app and edited admin screens: JavaScript/JSX parse passed with esbuild. A full Expo lint/build was not run because apps/mobile/node_modules is absent in this workspace.
- Backend tests could not execute because Maven Central was unreachable from this workspace; Render/local Maven should compile and run them where dependencies are available.
- The workspace snapshot has no Git metadata, so no commit or push was made.
