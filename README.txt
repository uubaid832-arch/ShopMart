ShopMart notification timing and mobile campaign scroll update

Replace these complete files in the matching paths in your ShopMart project:
- apps/mobile/src/admin/AdminVouchers.js
- apps/mobile/src/admin/adminUi.js
- apps/web/src/features/auth/useSession.js

Changes:
- Mobile admin action success and error feedback appears as a popup toast and auto-dismisses after 3.5 seconds.
- The mobile Product discounts / campaign form now has its own scrollable area inside the admin screen.
- Existing web sign-in/sign-up session toast messages now auto-dismiss after 3.5 seconds.

After replacing the files, restart the mobile development server and reload the app. For web, run the usual lint/build commands before deployment.
