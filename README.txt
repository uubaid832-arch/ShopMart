ShopMart Product Search and Rider Search Update

Replace files by preserving the folder paths in the project root.

Changes:
- Customer product search ranks exact/prefix/name matches above category and description matches on web and mobile.
- Search automatically collapses category and price filters; customers can reopen filters.
- Added an On sale first sort option to the customer catalog on web and mobile.
- Added rider order search by order number and customer name on web and mobile.
- Rider search is applied on the server before pagination, across all deliveries within the chosen rider tab.

No database migration is required.

Validation performed:
- Web production build: passed.
- Web ESLint: passed.
- Mobile changed files parsed with Babel: passed.
- Mobile Expo lint could not configure because network access to the Expo lint setup timed out. No TypeScript compiler is installed in the mobile project.
- Backend Maven compile could not resolve the existing Spring Boot parent because Maven Central DNS was unavailable in this environment.

After copying the files, build the backend and web app in your own environment, then commit/push:
  cd backend/shopmart-api
  ./mvnw -B -DskipTests compile
  cd ../../apps/web
  npm run build
  npm run lint
  cd ../..
  git add apps/web/src/App.jsx apps/web/src/api/riderDeliveries.js apps/web/src/features/rider/RiderDeliveries.jsx apps/mobile/App.js apps/mobile/src/rider/RiderScreen.js backend/shopmart-api/src/main/java/com/shopmart/api/delivery/RiderDeliveryController.java backend/shopmart-api/src/main/java/com/shopmart/api/delivery/RiderDeliveryService.java
  git commit -m "Improve product relevance and rider order search"
  git push origin HEAD
