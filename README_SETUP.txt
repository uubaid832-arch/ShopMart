ShopMart rider/admin warehouse address update

Included changes:
- Active riders are selected from a searchable dropdown in mobile admin order assignment.
- Saved customer addresses are hidden in rider/admin profile views; customers retain their saved-address feature.
- Admin mobile My account has a Warehouse return address editor.
- Return instruction drafts on web and mobile read the same administrator-configured address from the backend.

Setup:
1. Copy included files into the matching project paths.
2. Run the SQL in backend/shopmart-api/database/021_admin_warehouse_address.sql once in the deployed Neon database.
3. Build/deploy the backend and web app.
4. Open the mobile Admin app: My account > Warehouse return address, enter the full address/city/contact, and save.
5. Build/install the updated mobile app.

No new package or environment variable is required.
