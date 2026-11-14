Warehouse address HTTP 403 fix

Replace both files at their matching project paths. The warehouse address API routes need explicit ADMIN permissions because both security chains deny unmatched requests.

No additional database migration is required for this authorization fix. The earlier 021_admin_warehouse_address.sql migration must still be applied for the settings table. Commit and deploy the backend after copying these files.
