const readable = (value = "") =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function normalizeOrder(order) {
  const isSafepay = order.paymentProvider === "SAFEPAY";
  const isBankTransfer = order.paymentMethod === "BANK_TRANSFER";
  return {
    ...order,
    customerName: order.delivery.name,
    deliveryAddress: [order.delivery.address, order.delivery.city].join(", "),
    total: Number(order.total),
    status: readable(order.status),
    paymentMethod: isSafepay
      ? "Safepay (Sandbox)"
      : order.paymentMethod === "COD"
        ? "Cash on Delivery"
        : order.paymentMethod,
    // Keep the provider/database status available for action logic. The
    // display label below is title-cased and must not drive state checks.
    paymentStatusCode: order.paymentStatus,
    paymentStatus:
      isSafepay && order.paymentStatus === "DEMO_PAID"
        ? "Paid via Safepay"
        : isBankTransfer && order.paymentStatus === "PAID"
          ? "Bank transfer received"
        : readable(order.paymentStatus),
    items: order.items.map((item) => ({
      ...item,
      id: item.productId,
      unitPrice: Number(item.price),
    })),
  };
}

async function adminRequest(path, accessToken, { signal, status, method, values } = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const write = Boolean(status || method);
  if (write) {
    const response = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Could not prepare the secure request.");
    }

    const csrf = await response.json();

    headers[csrf.headerName] = csrf.token;
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api/admin/orders${path}`, {
    method: write ? (method || "PATCH") : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    signal,
    body: status ? JSON.stringify({ status }) : values ? JSON.stringify(values) : undefined,
  });

  if (!response.ok) {
    const messages = {
      400: "Please select a valid order status.",
      401: "Your session has expired. Please sign in again.",
      403: "Access was denied. Check your administrator sign-in and try again.",
      404: "Order not found.",
      409: "This change is not allowed. Reopen the order to check its current status.",
    };

    throw new Error(
      messages[response.status] ??
        "The request could not be confirmed. Reopen the order to check its status before trying again.",
    );
  }

  return response.json();
}

export async function getAdminOrders(accessToken, page, signal, size = 20, search = "") {
  const data = await adminRequest(
    `?page=${page}&size=${size}&search=${encodeURIComponent(search.trim())}`,
    accessToken,
    {
    signal,
    },
  );

  return {
    ...data,
    items: data.items.map((order) => ({
      ...order,
      total: Number(order.total),
      status: readable(order.status),
    })),
  };
}

export async function getAdminOrder(accessToken, id, signal) {
  return normalizeOrder(await adminRequest(`/${id}`, accessToken, { signal }));
}

export async function updateAdminOrderStatus(accessToken, id, status) {
  return normalizeOrder(
    await adminRequest(`/${id}/status`, accessToken, { status }),
  );
}

export async function confirmAdminBankTransferReceipt(accessToken, id) {
  return normalizeOrder(
    await adminRequest(`/${id}/bank-transfer/confirm`, accessToken, { method: "POST" }),
  );
}

