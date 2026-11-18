ShopMart checkout conflict message fix

Replace this file in the project:
apps/web/src/api/orders.js

This update reads Spring ProblemDetail's `detail` field as well as `message`.
It makes checkout show the backend's actual reason for HTTP 409 instead of a
misleading generic stock/checkout message. This is important when a previous
Safepay checkout is still pending or under review; resume/check that checkout
before placing another order so the customer is not charged twice.

No database migration is required.
