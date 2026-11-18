ShopMart store settings, campaign, theme and notifications update

This archive contains the complete changed source files for the ShopMart city/store settings feature plus the latest refinements. Extract it into your ShopMart project root and replace files when prompted.

Included updates:
- Admin web/mobile operating cities appear as saved chips; Enter adds a city and × removes it.
- Checkout tells customers which cities ShopMart currently operates in.
- Mobile admin has a separate Store details option for operating cities, warehouse, WhatsApp and bank details.
- Mobile campaign products are selected from a collapsible product list, with search and per-product discount controls.
- Promotion banner and action notification colors work with the selected dark theme.
- Web API actions show success/error notifications that dismiss after 3.5 seconds. Mobile admin action feedback uses short popup notifications.
- Store profile falls back to the first operating city if the warehouse city is blank; web displays backend validation messages.

Database:
Apply backend/shopmart-api/database/028_storefront_settings.sql to the Neon database configured in Render. This migration is safe to rerun; it fills a blank warehouse city from the first operating city.

Then commit and push the source so Render can deploy it. Restart Expo or reload the mobile app to pick up the mobile changes.

Checks performed:
- Web npm run lint and npm run build passed. Vite still reports its existing large JavaScript chunk warning.
- Edited mobile JSX files parsed successfully with Babel.
- Maven compilation could not be checked here because the Spring Boot parent dependency was not available in the local Maven cache.
