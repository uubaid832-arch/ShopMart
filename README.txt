ShopMart admin store settings HTTP 400 fix

Replace these complete files in the matching paths:
- backend/shopmart-api/src/main/java/com/shopmart/api/admin/AdminStoreSettingsService.java
- backend/shopmart-api/database/028_storefront_settings.sql
- apps/web/src/api/adminStoreSettings.js

Cause addressed:
The warehouse city column defaults to an empty value, while saving store settings requires a warehouse city. The profile now returns the first operating city (Lahore by default) when the warehouse city has not been set. Migration 028 also fills any existing blank warehouse city from the first configured operating city. The web form will display Spring validation details instead of only a generic HTTP status.

Apply the updated 028_storefront_settings.sql to the same Neon database configured in Render. It is safe to rerun: columns use IF NOT EXISTS and the data updates only fill blank values. Then commit/push the source and let Render deploy the backend and web app.

Web validation: npm run lint and npm run build passed. Maven compile could not be checked here because its Spring Boot parent POM is not present in the local Maven cache and Maven Central is unavailable in offline mode.
