ShopMart Delivery Status, Theme, and Cart/Wishlist Update

Extract this ZIP into the ShopMart project root and replace the matching files. All files are complete source replacements and retain their project folder paths.

Changes included:
- Admin delivery cards and recent dashboard orders show clear “Delivery unsuccessful” or “Returned to warehouse” indicators.
- Updated delivery/revenue panels and campaign sale badges to use light/dark theme colors. Lowered product wishlist-heart stacking and raised the sticky navbar so hearts stay beneath the search bar.
- Product images and names in the web cart and wishlist open product details. Mobile cart images and names open product details; mobile wishlist product cards already open the same details screen.
- Includes the previous rider global-search and checkout free-delivery/city-label changes so the shared web and mobile App files stay in sync.

No database migration is required.

Validation performed:
- Web production build and ESLint passed.
- Babel syntax parsing passed for modified mobile JavaScript files.
- Backend Maven compile could not run because Maven Central was unreachable in this environment. Compile it locally before deploying.

Push the replacement files:
  git add apps/web/src/App.jsx apps/web/src/components/Navbar.jsx apps/web/src/features/cart/CartPanel.jsx apps/web/src/features/wishlist/WishlistModal.jsx apps/web/src/features/admin/AdminDeliveries.jsx apps/web/src/features/admin/AdminDashboard.jsx apps/web/src/features/rider/RiderDeliveries.jsx apps/web/src/api/riderDeliveries.js apps/web/src/features/checkout/CheckoutModal.jsx apps/mobile/App.js apps/mobile/src/cart/CartFlow.js apps/mobile/src/cart/CartModal.js apps/mobile/src/admin/AdminLogistics.js apps/mobile/src/admin/AdminScreen.js apps/mobile/src/admin/adminUi.js apps/mobile/src/rider/RiderScreen.js apps/mobile/src/checkout/CheckoutModal.js backend/shopmart-api/src/main/java/com/shopmart/api/delivery/DeliveryService.java backend/shopmart-api/src/main/java/com/shopmart/api/delivery/RiderDeliveryController.java backend/shopmart-api/src/main/java/com/shopmart/api/delivery/RiderDeliveryService.java backend/shopmart-api/src/main/java/com/shopmart/api/admin/AdminDashboardService.java
  git commit -m "Show delivery alerts and open cart product details"
  git push origin HEAD
