async function placeOrder({
  accessToken,
  idempotencyKey,
  details,
  items,
  paymentMethod,
}) {
  if (!accessToken) {
    throw new Error("Please sign in before placing your order.");
  }

  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare checkout. Please try again.");
  }

  const csrf = await csrfResponse.json();

  if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
    throw new Error("The server returned an unexpected security response.");
  }

  const response = await fetch("/api/orders", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({
      idempotencyKey,
      name: details.name.trim(),
      email: details.email.trim(),
      phone: details.phone.trim(),
      address: details.address.trim(),
      city: details.city.trim(),
      paymentMethod,
      items: items.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    }),
  });

  if (!response.ok) {
    const messages = {
      400: "Please check your delivery details and quantities.",
      401: "Your sign-in has expired. Please sign in again.",
      403: "Checkout security verification failed. Please try again.",
      409: "Stock or checkout details changed. Please review your order.",
    };

    const error = new Error(
      messages[response.status] ??
        "Could not confirm the order. Retry without changing your details.",
    );

    error.status = response.status;
    throw error;
  }

  return response.json();
}
export function placeCodOrder(values) {
  return placeOrder({ ...values, paymentMethod: "COD" });
}

export function placeDemoOrder(values) {
  return placeOrder({ ...values, paymentMethod: "DEMO" });
}
export async function getCustomerOrders(accessToken, page = 0, signal) {
  const response = await fetch(`/api/orders?page=${page}&size=10`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Please sign in again to view your orders."
        : "Could not load your orders. Please try again.",
    );
  }

  const data = await response.json();

  return {
    ...data,
    items: data.items.map((order) => ({
      ...order,
      total: Number(order.total),
      items: order.items.map((item) => ({
        ...item,
        id: item.productId,
        price: Number(item.price),
      })),
    })),
  };
}

export async function getOrderTracking(accessToken, orderId, signal) {
  const response = await fetch(`/api/orders/${orderId}/tracking`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  });

  if (!response.ok) {
    const messages = {
      401: "Please sign in again to track your order.",
      404: "Order not found.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not load tracking information. Please try again.",
    );
  }

  return response.json();
}
export async function processMockPayment({
  accessToken,
  idempotencyKey,
  details,
  items,
  paymentDetails,
}) {
  if (!accessToken) {
    throw new Error("Please sign in before placing your order.");
  }

  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure payment request.");
  }

  const csrf = await csrfResponse.json();

  if (typeof csrf.headerName !== "string" || typeof csrf.token !== "string") {
    throw new Error("Unexpected security response.");
  }

  const response = await fetch("/api/checkout/process-payment", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({
      ...paymentDetails,
      order: {
        idempotencyKey,
        name: details.name.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        address: details.address.trim(),
        city: details.city.trim(),
        paymentMethod: "DEMO",
        items: items.map(({ id, quantity }) => ({
          productId: id,
          quantity,
        })),
      },
    }),
  });

  if (!response.ok) {
    const messages = {
      400: "Use the supplied test payment details and check your delivery details.",
      401: "Please sign in again.",
      403: "Payment access was denied. Check your sign-in and security configuration.",
      409: "Order details or stock changed. Review your cart before retrying.",
      422: "Test payment declined. No order was created. Try the successful test details.",
    };

    const error = new Error(
      messages[response.status] ??
        "Could not confirm the order. Retry here using the same details.",
    );

    error.status = response.status;
    throw error;
  }

  return response.json();
}
