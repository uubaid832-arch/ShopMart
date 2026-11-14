ShopMart web admin account update

This package adds an Admin > My account page for editing account name/phone, changing the password, and saving the shared warehouse return address. Web return instructions read the same saved warehouse setting. It also includes the backend controller/service, security allow-list entries, and Neon migration 021 required by the address setting.

Install: Extract into the project root and preserve the included apps/ and backend/ paths. Run database/021_admin_warehouse_address.sql once in the Neon database used by Render (skip if already applied). Push and deploy the backend and web app. Then open Admin > My account and save the actual warehouse address.
