ShopMart operating cities, warehouse, and bank transfer settings

INSTALL
1. Copy/extract these project-relative files into the ShopMart repository, replacing matching files.
2. Before deploying the backend, run backend/shopmart-api/database/028_storefront_settings.sql in the Neon SQL Editor connected to the Render database.
3. Commit and push the included changes so Render deploys the backend and web updates. Rebuild/reload the Expo app for mobile changes.

ADMIN
In Admin > My account, enter one operating city per line (or separated by commas on mobile). Checkout and saved-address forms offer only those cities; the backend rejects unsupported city values. The page also saves the warehouse street address, city, optional contact number, customer WhatsApp number, bank name, account title, account number, and IBAN.

BANK TRANSFER
Web and mobile checkout fetch public store settings. The bank details and WhatsApp link reflect the latest admin settings. New bank-transfer orders remain pending until an administrator confirms the receipt.

VALIDATION
Web npm run lint and npm run build passed. Mobile JSX syntax parsing passed. Backend Maven compile could not run because Maven Central DNS was unavailable in this environment; no tests were run. The web build reports its existing large-chunk advisory.
