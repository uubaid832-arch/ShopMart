import { useState } from "react";
import AdminOrders from "./AdminOrders";
import AdminOrderDetails from "./AdminOrderDetails";

const sampleOrders = [
  {
    id: "sample-order-1",
    orderNumber: "DEMO-001",
    customerName: "Sample Customer",
    status: "Pending",
    paymentMethod: "Cash on Delivery",
    paymentStatus: "Unpaid",
    deliveryAddress: "Sample delivery address, Lahore",
    currency: "PKR",
    total: 4500,
    items: [
      {
        id: "sample-item-1",
        name: "Wireless Headphones",
        quantity: 1,
        unitPrice: 4500,
      },
    ],
  },
];

export default function AdminOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState(null);

  return (
    <>
      <p className="mb-4 mt-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sample order · For UI testing only. No purchase or payment occurred.
      </p>

      <AdminOrders orders={sampleOrders} onView={setSelectedOrder} />

      {selectedOrder && (
        <AdminOrderDetails
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}
