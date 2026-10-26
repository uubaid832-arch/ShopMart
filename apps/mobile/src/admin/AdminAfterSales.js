import CustomerContact from "./CustomerContact";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  adminRequest,
  dateLabel,
  money,
  readable,
  useAdminResource,
} from "./adminApi";
import {
  Badge,
  Button,
  Card,
  check,
  Choice,
  confirm,
  Field,
  Form,
  Notice,
  Page,
  PagedList,
  ui,
  useMutation,
} from "./adminUi";

function RefundEditor({ request, op, onSave }) {
  const [reference, setReference] = useState("");
  const [paid, setPaid] = useState(false);
  return (
    <Form>
      <Notice op={op} />
      <Card
        title="Record a paid COD refund"
        subtitle={`${request.orderNumber} · ${request.productName} × ${request.quantity}`}
      >
        <Text style={ui.body}>{request.customerName}</Text>
        <Text style={ui.amount}>{money(request.refundAmount)}</Text>
        <View style={ui.info}>
          <Text style={ui.body}>
            This records money you have already refunded outside ShopMart. It
            does not transfer money. Pay the customer first and keep the
            receipt.
          </Text>
        </View>
        <Field
          label="Payment / receipt reference"
          value={reference}
          onChangeText={setReference}
          maxLength={200}
          editable={!op.blocked}
        />
        <View style={ui.switchRow}>
          <Text style={[ui.body, ui.grow]}>
            I have paid this refund to the customer.
          </Text>
          <Switch
            accessibilityLabel="Customer has received this refund"
            value={paid}
            onValueChange={setPaid}
            disabled={op.blocked}
          />
        </View>
        <Button
          title="Record paid refund"
          icon="check"
          disabled={op.blocked || !paid || !reference.trim()}
          onPress={() =>
            confirm(
              "Record refund?",
              `Confirm ${money(request.refundAmount)} has already been paid to ${request.customerName}.`,
              () => onSave(reference.trim()),
            )
          }
        />
      </Card>
    </Form>
  );
}
export function ReturnsModule({ session, onClose, onChanged }) {
  const [contact, setContact] = useState(null);
  const [rejection, setRejection] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [refund, setRefund] = useState(null);
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  const result = useAdminResource(
    session.accessToken,
    `/returns?page=${page}&size=15`,
    revision,
  );
  function change(item, next, reason = "") {
    const messages = {
      APPROVED:
        "Confirm you inspected the goods and they are in their original condition? Accepting allows refund recording.",
      CONTACTED: "Confirm you sent the return instructions to the customer?",
      REJECTED:
        "Reject after inspection? The reason will be sent in the customer notification/email. The product must be shipped back separately.",
      RECEIVED:
        "Confirm only after physically receiving the returned goods. Refund recording is a separate step.",
    };
    confirm(
      `${readable(next)} return?`,
      messages[next],
      () =>
        op.run(
          () =>
            adminRequest(session.accessToken, `/returns/${item.id}/status`, {
              method: "PATCH",
              values: { status: next, rejectionReason: reason || undefined },
            }),
          "Return updated.",
          () => {
            setRejection(null);
            setRejectionReason("");
          },
        ),
      next === "REJECTED",
    );
  }
  if (contact)
    return (
      <CustomerContact
        key={contact.id}
        session={session}
        item={contact}
        mode="return"
        onClose={() => {
          setContact(null);
          refresh();
        }}
        onInstructionsSent={
          contact.status === "PENDING" && !contact.instructionsSentAt
            ? async () => {
                const saved = await op.run(
                  () =>
                    adminRequest(
                      session.accessToken,
                      `/returns/${contact.id}/status`,
                      { method: "PATCH", values: { status: "CONTACTED" } },
                    ),
                  "Instructions marked sent.",
                );
                if (saved) setContact(null);
                return saved;
              }
            : undefined
        }
      />
    );
  if (rejection)
    return (
      <Page
        title="Reject after inspection"
        onClose={onClose}
        onBack={() => {
          if (!op.busy) setRejection(null);
        }}
        busy={op.busy}
      >
        <Form>
          <Notice op={op} />
          <Card title={rejection.productName} subtitle={rejection.orderNumber}>
            <Text style={ui.body}>
              Record why the received product is not acceptable. The customer
              notification/email will include this reason and explain that their
              product will be shipped back soon.
            </Text>
            <Field
              label="Inspection / rejection reason"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              maxLength={1000}
              multiline
              editable={!op.blocked}
            />
            <Button
              title="Reject & notify customer"
              danger
              icon="close"
              disabled={op.blocked || !rejectionReason.trim()}
              onPress={() =>
                change(rejection, "REJECTED", rejectionReason.trim())
              }
            />
          </Card>
        </Form>
      </Page>
    );
  return (
    <Page
      title={refund ? "Record refund" : "Returns & refunds"}
      busy={op.busy}
      onClose={onClose}
      onBack={
        refund
          ? () => {
              op.reset();
              setRefund(null);
            }
          : undefined
      }
      onRefresh={
        !refund
          ? () => {
              op.reset();
              refresh();
            }
          : undefined
      }
    >
      {refund ? (
        <RefundEditor
          request={refund}
          op={op}
          onSave={(reference) =>
            op.run(
              () => {
                check(reference, "Enter a receipt reference.");
                return adminRequest(
                  session.accessToken,
                  `/returns/${refund.id}/refund`,
                  { method: "POST", values: { reference } },
                );
              },
              "Refund recorded.",
              () => setRefund(null),
            )
          }
        />
      ) : (
        <>
          <PagedList
            toolbar={
              <View style={ui.toolbar}>
                <Notice op={op} />
                <Choice
                  compact
                  label="Return status"
                  value={status}
                  options={[
                    "ALL",
                    "PENDING",
                    "APPROVED",
                    "REJECTED",
                    "RECEIVED",
                  ].map((value) => ({ value, label: readable(value) }))}
                  onChange={setStatus}
                />
              </View>
            }
            result={result}
            page={page}
            onPage={setPage}
            search={search}
            onSearch={setSearch}
            filter={(item) => status === "ALL" || item.status === status}
            renderItem={(item) => (
              <Card
                title={item.productName}
                subtitle={`${item.orderNumber} · ${item.customerName}`}
              >
                <View style={ui.row}>
                  <Badge
                    value={
                      item.status === "APPROVED"
                        ? "Accepted after inspection"
                        : item.status === "RECEIVED"
                          ? "Received - inspect next"
                          : item.status === "PENDING" && item.instructionsSentAt
                            ? "Awaiting parcel"
                            : item.status
                    }
                  />
                  <Badge value={item.refundStatus} />
                </View>
                <Text style={ui.body}>
                  Quantity: {item.quantity} · {item.paymentMethod}
                </Text>
                <Text style={ui.body}>Reason: {item.reason}</Text>
                <Text style={ui.amount}>{money(item.refundAmount)}</Text>
                <Text style={ui.muted}>{dateLabel(item.createdAt)}</Text>
                {item.rejectionReason && (
                  <View style={ui.info}>
                    <Text style={ui.body}>
                      Inspection rejection: {item.rejectionReason}
                    </Text>
                    <Text style={ui.muted}>
                      Return shipment to the customer must be arranged
                      separately.
                    </Text>
                  </View>
                )}
                {["PENDING", "REJECTED"].includes(item.status) && (
                  <Button
                    title={
                      item.status === "REJECTED"
                        ? "Email / WhatsApp rejection reason"
                        : "Contact customer / return instructions"
                    }
                    icon="chat"
                    secondary
                    disabled={op.busy}
                    onPress={() => setContact(item)}
                  />
                )}
                {item.status === "PENDING" &&
                  (item.instructionsSentAt ? (
                    <Button
                      title="Confirm goods physically received"
                      icon="box"
                      disabled={op.blocked}
                      onPress={() => change(item, "RECEIVED")}
                    />
                  ) : (
                    <Text style={ui.muted}>
                      Send the warehouse instructions, then confirm
                      "Instructions sent" in the contact screen.
                    </Text>
                  ))}
                {item.status === "RECEIVED" && (
                  <Card title="Inspect received goods">
                    <Text style={ui.body}>
                      Check that the returned item is in its original condition,
                      with its accessories. Accept it for refund processing or
                      reject it with a reason.
                    </Text>
                    <View style={ui.row}>
                      <Button
                        title="Accept after inspection"
                        icon="check"
                        secondary
                        disabled={op.blocked}
                        onPress={() => change(item, "APPROVED")}
                      />
                      <Button
                        title="Reject after inspection"
                        icon="close"
                        danger
                        disabled={op.blocked}
                        onPress={() => {
                          op.reset();
                          setRejectionReason("");
                          setRejection(item);
                        }}
                      />
                    </View>
                  </Card>
                )}
                {item.status === "APPROVED" &&
                  item.paymentMethod === "COD" &&
                  item.refundStatus !== "REFUNDED" && (
                    <Button
                      title="Record paid refund"
                      icon="wallet"
                      disabled={op.blocked}
                      onPress={() => {
                        op.reset();
                        setRefund(item);
                      }}
                    />
                  )}
                {item.paymentMethod === "DEMO" && (
                  <Text style={ui.muted}>
                    Demo payments do not support a real cash refund here.
                  </Text>
                )}
              </Card>
            )}
          />
        </>
      )}
    </Page>
  );
}
export function ReviewsModule({ session, onClose, onChanged }) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("ALL");
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  const result = useAdminResource(
    session.accessToken,
    `/reviews?page=${page}&size=15`,
    revision,
  );
  return (
    <Page
      title="Review moderation"
      onClose={onClose}
      busy={op.busy}
      onRefresh={() => {
        op.reset();
        refresh();
      }}
    >
      <PagedList
        toolbar={
          <View style={ui.toolbar}>
            <Notice op={op} />
            <Choice
              compact
              label="Visibility"
              value={visibility}
              options={[
                { value: "ALL", label: "All reviews" },
                { value: "VISIBLE", label: "Visible" },
                { value: "HIDDEN", label: "Hidden" },
              ]}
              onChange={setVisibility}
            />
          </View>
        }
        result={result}
        page={page}
        onPage={setPage}
        search={search}
        onSearch={setSearch}
        filter={(item) =>
          visibility === "ALL" ||
          (visibility === "VISIBLE" ? item.visible : !item.visible)
        }
        renderItem={(item) => (
          <Card title={item.productName} subtitle={item.authorName}>
            <View style={ui.row}>
              <Text style={[ui.amount, { fontSize: 18 }]}>
                {"★".repeat(item.rating)}
                {"☆".repeat(5 - item.rating)}
              </Text>
              <Badge value={item.visible ? "Visible" : "Hidden"} />
            </View>
            <Text selectable style={ui.body}>
              {item.comment || "No written comment."}
            </Text>
            <Text style={ui.muted}>{dateLabel(item.createdAt)}</Text>
            <Button
              title={item.visible ? "Hide review" : "Publish review"}
              secondary={!item.visible}
              danger={item.visible}
              disabled={op.blocked}
              onPress={() =>
                confirm(
                  item.visible ? "Hide review?" : "Publish review?",
                  item.visible
                    ? "Hide this review from the public product page? The original review is retained."
                    : "Make this review visible on the public product page?",
                  () =>
                    op.run(
                      () =>
                        adminRequest(
                          session.accessToken,
                          `/reviews/${item.id}/visibility`,
                          {
                            method: "PATCH",
                            values: { visible: !item.visible },
                          },
                        ),
                      "Review visibility updated.",
                    ),
                  item.visible,
                )
              }
            />
          </Card>
        )}
      />
    </Page>
  );
}
