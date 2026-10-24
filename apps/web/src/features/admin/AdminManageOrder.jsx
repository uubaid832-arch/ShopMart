import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal";
import AssignRiderModal from "./AssignRiderModal";
import DeliveryLocationMap from "../tracking/DeliveryLocationMap";
import { useSession } from "../auth/useSession";
import { getAdminOrder, updateAdminOrderStatus } from "../../api/adminOrders";
import { getOrderAssignment } from "../../api/orderDelivery";
import { assignDeliveryRider } from "../../api/deliveries";
import InvoiceDownload from "../../components/InvoiceDownload";
import {
  getWarehouseState,
  confirmWarehouseReceipt,
  resolveWarehouseReturn,
} from "../../api/warehouse";

const stages = ["PENDING", "CONFIRMED", "DISPATCHED", "DELIVERED"];

const labels = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const reasons = {
  CUSTOMER_REFUSED: "Customer refused the order",
  CUSTOMER_UNAVAILABLE: "Customer unavailable",
  UNREACHABLE: "Customer not answering",
  INCORRECT_ADDRESS: "Incorrect or incomplete address",
  DAMAGED_PACKAGE: "Package damaged",
  OTHER: "Other delivery problem",
};

const primary =
  "w-full rounded-xl border-0 bg-violet-600 px-4 py-3 text-sm font-semibold text-white enabled:hover:bg-violet-700 disabled:opacity-50";

const danger =
  "w-full rounded-xl border-0 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 enabled:hover:bg-rose-100 disabled:opacity-50";

const outline =
  "rounded-xl border border-solid border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 enabled:hover:bg-slate-100 disabled:opacity-50";

const card =
  "min-w-0 rounded-2xl border border-solid border-slate-200 bg-white p-4 sm:p-5";

export default function AdminManageOrder({ id, onClose }) {
  const { session } = useSession();
  const token = session?.accessToken;

  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const inFlight = useRef(false);

  function close() {
    if (!inFlight.current) onClose();
  }

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    Promise.all([
      getAdminOrder(token, id, controller.signal),
      getOrderAssignment(token, id, controller.signal),
      getWarehouseState(token, "admin", id, controller.signal),
    ])
      .then(([order, assignment, warehouse]) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            id,
            reload,
            order,
            assignment,
            warehouse,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            id,
            reload,
            order: null,
            assignment: null,
            warehouse: null,
            error: error.message || "Could not load this order.",
          });
        }
      });

    return () => controller.abort();
  }, [token, id, reload]);

  const current =
    result?.token === token && result?.id === id && result?.reload === reload;

  const order = current ? result.order : null;
  const assignment = current ? result.assignment : null;
  const warehouse = current ? result.warehouse : null;
  const delivery = assignment?.delivery;
  const riders = assignment?.riders ?? [];

  async function runAction(key, request, success) {
    if (inFlight.current) return;

    inFlight.current = true;
    setSaving(key);
    setFeedback("");
    setActionError("");

    try {
      await request();
      setFeedback(success);
      setReload((value) => value + 1);
    } catch (error) {
      setActionError(error.message || "Could not complete this action.");
    } finally {
      inFlight.current = false;
      setSaving("");
    }
  }

  async function changeStatus(status) {
    if (inFlight.current) return;

    if (
      status === "CANCELLED" &&
      !window.confirm("Cancel this order and restore its product stock?")
    ) {
      return;
    }

    await runAction(
      status,
      () => updateAdminOrderStatus(token, id, status),
      status === "CONFIRMED"
        ? "Order confirmed. Assign a rider below."
        : status === "DISPATCHED"
          ? "Order dispatched. The rider has been notified."
          : "Order cancelled and stock restored.",
    );
  }

  async function saveAssignment(riderId) {
    if (inFlight.current) {
      throw new Error("Please wait for the current request.");
    }

    inFlight.current = true;
    setSaving("assignment");
    setFeedback("");
    setActionError("");

    try {
      await assignDeliveryRider(token, id, riderId);
      setFeedback("Rider assigned. The order is ready to dispatch.");
      setReload((value) => value + 1);
    } finally {
      inFlight.current = false;
      setSaving("");
    }
  }

  async function receiveParcel() {
    if (inFlight.current || !warehouse?.attemptId) return;

    if (
      !window.confirm(
        "Confirm that the warehouse has physically received this parcel?",
      )
    ) {
      return;
    }

    await runAction(
      "receipt",
      () => confirmWarehouseReceipt(token, id, warehouse.attemptId),
      "Warehouse receipt confirmed. Arrange another delivery or cancel the order below.",
    );
  }

  async function resolveReturn(action, riderId) {
    if (inFlight.current || !warehouse?.attemptId) return;

    if (action === "RETRY" && !riderId) {
      setActionError("Select an enabled rider for another delivery.");
      return;
    }

    const message =
      action === "CANCEL"
        ? "Cancel this order and restore stock? Confirm that the goods were received back."
        : "Arrange another delivery with the selected rider? The order will await dispatch.";

    if (!window.confirm(message)) return;

    await runAction(
      action,
      () =>
        resolveWarehouseReturn(token, id, {
          attemptId: warehouse.attemptId,
          action,
          riderId: action === "RETRY" ? riderId : null,
        }),
      action === "RETRY"
        ? "Another delivery arranged. Mark the order dispatched when ready."
        : "Order cancelled and stock restored.",
    );
  }

  if (!current || result.error || !order) {
    return (
      <Modal
        onClose={close}
        labelledBy="manage-order-title"
        size="xl"
        fixedSections
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-0 border-b border-solid border-slate-200 p-5">
          <h2 id="manage-order-title" className="m-0 text-xl font-bold">
            Manage order
          </h2>

          <button
            type="button"
            onClick={close}
            disabled={Boolean(saving)}
            aria-label="Close manage order"
            className="grid size-10 shrink-0 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {current && result.error ? (
            <p role="alert" className="m-0 text-sm text-rose-700">
              {result.error}
            </p>
          ) : (
            <p role="status" className="m-0 text-sm text-slate-500">
              Loading order and delivery details…
            </p>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-0 border-t border-solid border-slate-200 bg-white p-4">
          {current && result.error && (
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className={outline}
            >
              Try again
            </button>
          )}

          <button
            type="button"
            onClick={close}
            disabled={Boolean(saving)}
            className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Close
          </button>
        </footer>
      </Modal>
    );
  }

  if (assignOpen) {
    return (
      <AssignRiderModal
        delivery={delivery}
        riders={riders}
        onSave={saveAssignment}
        onClose={() => setAssignOpen(false)}
      />
    );
  }

  const status = String(order.status).toUpperCase();
  const isCod =
    order.paymentMethod === "Cash on Delivery" || order.paymentMethod === "COD";
  const isDemo = order.paymentMethod === "DEMO";
  const supportsDelivery = isCod || isDemo;

  const canAssign = supportsDelivery && status === "CONFIRMED";
  const riderReady = Boolean(delivery?.riderId && delivery.riderEnabled);
  const returning = Boolean(warehouse?.reportedAt && !warehouse.resolvedAt);
  const canDispatch = canAssign && riderReady && !returning;
  const canCancel =
    supportsDelivery && ["PENDING", "CONFIRMED"].includes(status) && !returning;
  const stage = stages.indexOf(status);

  const retryRider =
    selectedRider ??
    (riders.some((rider) => rider.id === delivery?.riderId)
      ? delivery.riderId
      : "");

  const formatPrice = (amount) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: order.currency ?? "PKR",
    }).format(Number(amount));

  const guidance = {
    PENDING: "Confirm this order, then assign a rider.",
    CONFIRMED: riderReady
      ? "A rider is assigned. Dispatch when the parcel is ready."
      : "Assign an enabled rider before dispatch.",
    DISPATCHED: returning
      ? "This parcel is in the warehouse return process. Use the controls below."
      : isDemo
        ? "The assigned rider must confirm delivery. No cash collection is required."
        : "The assigned rider must confirm delivery and cash collection.",
    DELIVERED: "Delivery has been completed by the rider.",
    CANCELLED: "The order was cancelled and stock restored.",
    RETURNED: "This order has been returned.",
  };

  const customerName = order.customerName ?? order.delivery?.name ?? "Customer";

  const address =
    order.deliveryAddress ??
    [order.delivery?.address, order.delivery?.city].filter(Boolean).join(", ");

  return (
    <Modal
      onClose={close}
      labelledBy="manage-order-title"
      size="xl"
      fixedSections
    >
      <header className="shrink-0 border-0 border-b border-solid border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-bold tracking-widest text-violet-600">
              ORDER MANAGEMENT
            </p>

            <h2
              id="manage-order-title"
              className="mb-1 mt-1 text-2xl font-bold"
            >
              Manage order
            </h2>

            <p className="m-0 break-all text-xs text-slate-500">
              {order.orderNumber}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 sm:inline-block">
              {labels[status] ?? order.status}
            </span>

            <button
              type="button"
              onClick={close}
              disabled={Boolean(saving)}
              aria-label="Close manage order"
              className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-2xl text-slate-600 enabled:hover:bg-violet-100 disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        <span className="mt-3 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 sm:hidden">
          {labels[status] ?? order.status}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-5">
        <div className="grid gap-4">
          {feedback && (
            <p
              role="status"
              className="m-0 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
            >
              {feedback}
            </p>
          )}

          {actionError && (
            <p
              role="alert"
              className="m-0 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
            >
              {actionError}
            </p>
          )}

          {stage >= 0 && (
            <ol
              aria-label="Order progress"
              className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4"
            >
              {stages.map((value, index) => (
                <li
                  key={value}
                  aria-current={index === stage ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                    index <= stage
                      ? "bg-violet-100 text-violet-800"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/50 text-[10px]">
                    {index + 1}
                  </span>
                  {labels[value]}
                </li>
              ))}
            </ol>
          )}

          <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className={card}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-base font-bold">Purchased items</h3>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">
                  {order.items?.length ?? 0} items
                </span>
              </div>

              <ul className="mb-0 mt-3 grid list-none p-0">
                {(order.items ?? []).map((item) => {
                  const price = item.unitPrice ?? item.price;

                  return (
                    <li
                      key={item.id ?? item.productId}
                      className="flex items-start justify-between gap-3 border-0 border-b border-solid border-slate-100 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="m-0 break-words text-sm font-semibold">
                          {item.name}
                        </p>
                        <p className="mb-0 mt-1 text-xs text-slate-500">
                          {formatPrice(price)} × {item.quantity}
                        </p>
                      </div>

                      <strong className="shrink-0 text-sm">
                        {formatPrice(Number(price) * item.quantity)}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className={card}>
              <h3 className="m-0 text-base font-bold">Payment & actions</h3>

              <div className="my-4 rounded-xl bg-violet-50 p-4">
                <p className="m-0 text-xs text-slate-500">
                  {isDemo
                    ? "Demo payment — no money charged"
                    : order.paymentMethod}
                </p>
                <p className="mb-2 mt-2 break-words text-2xl font-extrabold text-violet-700">
                  {formatPrice(order.total)}
                </p>
                <span className="inline-block rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {isDemo
                    ? status === "CANCELLED"
                      ? "Demo payment voided"
                      : "Test payment successful"
                    : order.paymentStatus}{" "}
                </span>
              </div>

              <p className="mb-4 mt-0 text-xs leading-5 text-slate-500">
                {guidance[status] ?? "No status changes are available here."}
              </p>

              <div className="grid gap-2">
                {supportsDelivery && status === "PENDING" && (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => changeStatus("CONFIRMED")}
                    className={primary}
                  >
                    {saving === "CONFIRMED" ? "Confirming…" : "Confirm order"}
                  </button>
                )}

                {canAssign && !riderReady && (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => setAssignOpen(true)}
                    className={primary}
                  >
                    {delivery?.riderId
                      ? "Assign enabled rider"
                      : "Assign rider"}
                  </button>
                )}

                {canDispatch && (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => changeStatus("DISPATCHED")}
                    className={primary}
                  >
                    {saving === "DISPATCHED"
                      ? "Dispatching…"
                      : "Mark dispatched"}
                  </button>
                )}

                {canCancel && (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => changeStatus("CANCELLED")}
                    className={danger}
                  >
                    {saving === "CANCELLED" ? "Cancelling…" : "Cancel order"}
                  </button>
                )}
              </div>
            </section>
          </div>

          <section className={card}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Customer & delivery
                </h3>

                <p className="mb-2 mt-3 break-words text-sm font-bold">
                  {customerName}
                </p>

                <p className="m-0 break-words text-sm leading-6 text-slate-500">
                  {address || "Address unavailable"}
                </p>

                {order.delivery?.phone && (
                  <a
                    href={`tel:${order.delivery.phone}`}
                    className="mt-2 block text-sm font-semibold text-violet-700"
                  >
                    {order.delivery.phone}
                  </a>
                )}

                {order.delivery?.email && (
                  <a
                    href={`mailto:${order.delivery.email}`}
                    className="mt-1 block break-all text-xs text-slate-500 hover:text-violet-700"
                  >
                    {order.delivery.email}
                  </a>
                )}
              </div>

              <div className="min-w-0 border-0 border-t border-solid border-slate-200 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Assigned rider
                </h3>

                <p className="mb-2 mt-3 break-words text-sm font-bold">
                  {delivery?.riderName ?? "Not assigned"}
                </p>

                <p className="m-0 text-xs leading-5 text-slate-500">
                  {delivery?.riderId
                    ? delivery.riderEnabled
                      ? "Enabled rider account"
                      : "This rider is unavailable. Assign an enabled rider before dispatch."
                    : "Assign a rider after confirming the order."}
                </p>

                {canAssign && riderReady && (
                  <button
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => setAssignOpen(true)}
                    className={`${outline} mt-3`}
                  >
                    Change rider
                  </button>
                )}
              </div>
            </div>
          </section>

          {status === "DISPATCHED" && riderReady && !returning && (
            <div className="min-w-0 rounded-2xl bg-white [&>section]:mt-0">
              <DeliveryLocationMap key={id} token={token} orderId={id} />
            </div>
          )}
          {supportsDelivery &&
            status === "DISPATCHED" &&
            warehouse?.attemptId &&
            !warehouse.resolvedAt && (
              <section className="rounded-2xl border border-solid border-amber-200 bg-amber-50 p-4 sm:p-5">
                <h3 className="m-0 text-base font-bold text-amber-900">
                  Warehouse return
                </h3>

                <p className="mb-0 mt-2 text-sm text-amber-800">
                  {reasons[warehouse.reason] ?? warehouse.reason}
                </p>

                {warehouse.note && (
                  <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm text-amber-800">
                    {warehouse.note}
                  </p>
                )}

                {!warehouse.reportedAt ? (
                  <p className="mb-0 mt-3 text-sm leading-6 text-slate-600">
                    Waiting for the rider to report the parcel physically
                    returned to the warehouse.
                  </p>
                ) : !warehouse.receivedAt ? (
                  <div className="mt-4 grid gap-3">
                    <p className="m-0 text-sm leading-6 text-slate-600">
                      The rider reported this parcel returned. Confirm receipt
                      only after checking the goods.
                    </p>

                    <button
                      type="button"
                      disabled={Boolean(saving)}
                      onClick={receiveParcel}
                      className={primary}
                    >
                      {saving === "receipt"
                        ? "Confirming…"
                        : "Confirm warehouse receipt"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    <p
                      role="status"
                      className="m-0 text-sm font-semibold text-emerald-800"
                    >
                      Warehouse receipt confirmed
                    </p>

                    <label className="grid gap-2 text-sm font-semibold">
                      Rider for another delivery
                      <select
                        value={retryRider}
                        disabled={Boolean(saving)}
                        onChange={(event) =>
                          setSelectedRider(event.target.value)
                        }
                        className="box-border w-full rounded-xl border border-solid border-slate-200 bg-white p-3"
                      >
                        <option value="">Select rider</option>
                        {riders.map((rider) => (
                          <option key={rider.id} value={rider.id}>
                            {rider.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={Boolean(saving) || !retryRider}
                        onClick={() => resolveReturn("RETRY", retryRider)}
                        className={primary}
                      >
                        {saving === "RETRY"
                          ? "Arranging…"
                          : "Arrange another delivery"}
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(saving)}
                        onClick={() => resolveReturn("CANCEL", null)}
                        className={danger}
                      >
                        {saving === "CANCEL"
                          ? "Cancelling…"
                          : "Cancel & restore stock"}
                      </button>
                    </div>

                    <p className="m-0 text-xs leading-5 text-slate-500">
                      Correct incorrect contact or address details in Deliveries
                      before arranging another delivery.
                    </p>
                  </div>
                )}
              </section>
            )}
        </div>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={Boolean(saving)}
            onClick={() => setReload((value) => value + 1)}
            className={outline}
          >
            Refresh
          </button>

          <InvoiceDownload orderId={id} admin />
        </div>

        <button
          type="button"
          disabled={Boolean(saving)}
          onClick={close}
          className="rounded-xl border-0 bg-violet-600 px-5 py-3 text-sm font-bold text-white enabled:hover:bg-violet-700 disabled:opacity-50"
        >
          Close manage order
        </button>
      </footer>
    </Modal>
  );
}
