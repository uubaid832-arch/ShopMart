ShopMart voucher checkout fix

This patch contains the checkout UI changes and backend campaign/voucher files from the supplied ShopMart source snapshot.

Fixes included
- Clear an entered but rejected/unapplied voucher so checkout can proceed without it. Applied vouchers retain a Remove action.
- Show campaign savings separately from voucher savings. Voucher discount is calculated only on full-price lines; automatic campaign reductions remain separate.
- Add a backend test for a mixed cart containing one campaign-priced item and one full-price voucher-eligible item.
- Include migration 024, which permits an order discount without voucher_id/voucher_code for automatic product campaigns.

Important for HTTP 500 on order placement
The migration must be applied to the same Neon database used by Render. Before retrying an uncertain order, check My Orders so you do not accidentally create another order. In Neon SQL Editor, inspect the constraint:

SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
  AND conname = 'orders_amounts_valid';

If the definition still requires discount_amount = 0 when voucher_id and voucher_code are NULL, run backend/shopmart-api/database/024_product_discount_campaigns.sql in the Neon SQL Editor. Do not run against a different branch/database. Then retry only after checking My Orders. If the constraint already matches migration 024, inspect the Render backend log for the POST /api/orders request; this patch cannot identify a different 500 cause without that log.

Install from the project root in PowerShell
1. Back up Neon, then run 024_product_discount_campaigns.sql in the correct Neon branch.
2. Extract this zip to a temporary folder. Copy the included apps and backend paths into the matching paths in your repository.
3. Run web checks:
   cd apps\web
   npm.cmd run lint
   npm.cmd run build
4. Run focused backend tests (requires Maven dependencies available):
   cd ..\..\backend\shopmart-api
   .\mvnw.cmd -Dtest=VoucherServiceTests test
5. Review git diff, then commit and push. Rebuild the Expo app for mobile changes.

Test results in this workspace
- Web eslint: passed.
- Web Vite production build: passed; Vite reported an existing large JavaScript chunk warning.
- Mobile checkout JSX parse: passed.
- Backend test execution: blocked because Maven Central DNS was unavailable in this workspace, so the new backend test was not executed here.
