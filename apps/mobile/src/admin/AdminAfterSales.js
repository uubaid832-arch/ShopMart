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
  function change(item, next) {
    const messages = {
      APPROVED: "Approve this customer's return request?",
      REJECTED: "Reject this return request?",
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
              values: { status: next },
            }),
          "Return updated.",
        ),
      next === "REJECTED",
    );
  }
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
          <View style={ui.toolbar}>
            <Notice op={op} />
            <Choice
              label="Return status on this page"
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
          <PagedList
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
                  <Badge value={item.status} />
                  <Badge value={item.refundStatus} />
                </View>
                <Text style={ui.body}>
                  Quantity: {item.quantity} · {item.paymentMethod}
                </Text>
                <Text style={ui.body}>Reason: {item.reason}</Text>
                <Text style={ui.amount}>{money(item.refundAmount)}</Text>
                <Text style={ui.muted}>{dateLabel(item.createdAt)}</Text>
                <View style={ui.row}>
                  {item.status === "PENDING" && (
                    <>
                      <Button
                        title="Approve"
                        icon="check"
                        secondary
                        disabled={op.blocked}
                        onPress={() => change(item, "APPROVED")}
                      />
                      <Button
                        title="Reject"
                        icon="close"
                        danger
                        disabled={op.blocked}
                        onPress={() => change(item, "REJECTED")}
                      />
                    </>
                  )}
                  {item.status === "APPROVED" && (
                    <Button
                      title="Confirm goods received"
                      icon="box"
                      disabled={op.blocked}
                      onPress={() => change(item, "RECEIVED")}
                    />
                  )}
                </View>
                {item.status === "RECEIVED" &&
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
      <View style={ui.toolbar}>
        <Notice op={op} />
        <Choice
          label="Visibility on this page"
          value={visibility}
          options={[
            { value: "ALL", label: "All reviews" },
            { value: "VISIBLE", label: "Visible" },
            { value: "HIDDEN", label: "Hidden" },
          ]}
          onChange={setVisibility}
        />
      </View>
      <PagedList
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
