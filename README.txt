ShopMart 5 feature backend patch (source: uploaded backend.rar)

IMPORTANT: this patch is based on the backend archive you uploaded, not automatically synchronized with your newest Git branch.

What it changes:
- Checkout API rejects >5 units of one product; field validation max=5.
- Admin product list: GET /api/admin/products?page=0&size=20&q=keyword&categoryId=uuid (same on mobile). Filters before pagination and returns matching totalItems.
- Admin order list: GET /api/admin/orders?page=0&size=20&q=keyword (same on mobile). Filters by order number, customer name, UUID or status before pagination.
- Admin category list: GET /api/admin/categories?q=keyword (same on mobile); returns [{id,name,productCount}].
- Customer product list: GET /api/products?page=0&size=12&q=keyword searches whole catalog before pagination.

NOT completed in this patch:
- Customer display of In stock vs exact quantity (must change web/mobile components).
- Quantity picker max=5 in web/mobile carts and product details.
- Admin category click navigation and search-field API wiring on web/mobile.
- Customer search results placed before hero on web/mobile.
No database migration is necessary for the backend endpoints.

INSTALL from D:\PROJECT-FYP\ShopMart:
  git status
  git apply --check D:\ShopMart-5-Features\ShopMart_5_Features_Backend_Update.patch
  git apply D:\ShopMart-5-Features\ShopMart_5_Features_Backend_Update.patch
  cd backend\shopmart-api
  .\mvnw.cmd -DskipTests compile
  .\mvnw.cmd test
  cd ..\..
  git diff
  git add backend/shopmart-api
  git commit -m "Improve product limits and global catalog/admin search"
  git push origin HEAD

If git apply --check fails, do not use git apply --reject or overwrite Java files blindly. Provide the current files for a rebased patch; recent Cloudinary changes may conflict.

Frontend implementation details:
- Show product.stock>0 ? 'In stock' : 'Out of stock' on customer details; no integer stock text. Backend retains stock for other existing clients.
- Apply per-product max of 5 in quantity selector and cart and show clear error; backend enforces it.
- Search: pass q to server, set page=0 when q changes, and display items from API; don't filter current page's items.
- Admin categories: fetch GET /api/admin/categories?q=; show productCount and click category fetch GET /api/admin/products?categoryId=<id>&page=0&size=20.
- When customer q is nonempty, render results and search heading before the hero, or hide hero while searching.

Note: Backend patch not compiled here; use the Maven commands above before deploying.
