import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  adminRequest,
  dateLabel,
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

function DeliveryEditor({ delivery, op, onSave }) {
  const [name, setName] = useState(delivery.customerName || "");
  const [email, setEmail] = useState(delivery.email || "");
  const [phone, setPhone] = useState(delivery.phone || "");
  const [addressLine, setAddress] = useState(delivery.addressLine || "");
  const [city, setCity] = useState(delivery.city || "");
  return (
    <Form>
      <Notice op={op} />
      <Card
        title={delivery.orderNumber}
        subtitle="Update delivery details before dispatch, or when the existing failure workflow allows correction."
      >
        <Field
          label="Recipient name"
          value={name}
          onChangeText={setName}
          maxLength={150}
          editable={!op.blocked}
        />
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={254}
          editable={!op.blocked}
        />
        <Field
          label="Phone (11 digits)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={11}
          editable={!op.blocked}
        />
        <Field
          label="Delivery address"
          value={addressLine}
          onChangeText={setAddress}
          multiline
          maxLength={500}
          editable={!op.blocked}
        />
        <Field
          label="City"
          value={city}
          onChangeText={setCity}
          maxLength={150}
          editable={!op.blocked}
        />
        <Button
          title="Save delivery details"
          icon="check"
          disabled={op.blocked}
          onPress={() => onSave({ name, email, phone, addressLine, city })}
        />
      </Card>
    </Form>
  );
}
function Warehouse({ session, delivery, onClose, onBack, onChanged }) {
  const [revision, setRevision] = useState(0);
  const [riderId, setRiderId] = useState("");
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  const path = `/deliveries/${delivery.orderId}`;
  const state = useAdminResource(
    session.accessToken,
    `${path}/warehouse`,
    revision,
  );
  const riders = useAdminResource(
    session.accessToken,
    "/deliveries/riders",
    revision,
  );
  const order = useAdminResource(
    session.accessToken,
    `/orders/${delivery.orderId}`,
    revision,
  );
  const value = state.data;
  const loading = state.loading || riders.loading || order.loading;
  const error = state.error || riders.error || order.error;
  const active = order.data?.status === "DISPATCHED" && !value?.resolvedAt;
  const locked = op.blocked || loading || Boolean(error);
  return (
    <Page
      title="Warehouse return"
      onClose={onClose}
      onBack={onBack}
      busy={op.busy}
      onRefresh={() => {
        op.reset();
        refresh();
      }}
    >
      <Form>
        <Text style={ui.title}>{delivery.orderNumber}</Text>
        <Notice op={op} />
        {loading ? (
          <ActivityIndicator color="#7c3aed" style={ui.loader} />
        ) : error ? (
          <Text style={ui.error}>{error}</Text>
        ) : (
          <>
            <Card title="Current delivery">
              <Badge value={order.data.status} />
              <Text style={ui.body}>{order.data.delivery?.name}</Text>
            </Card>
            {!value?.attemptId ? (
              <Card title="No delivery failure">
                <Text style={ui.body}>
                  There is no failed delivery attempt for this order.
                </Text>
              </Card>
            ) : (
              <>
                <Card title={readable(value.reason)}>
                  <Text style={ui.body}>{value.note || "No rider note."}</Text>
                  <Text style={ui.muted}>
                    Reported: {dateLabel(value.createdAt)}
                  </Text>
                  <Text style={ui.body}>
                    Rider warehouse return:{" "}
                    {value.reportedAt
                      ? dateLabel(value.reportedAt)
                      : "Not reported"}
                  </Text>
                  <Text style={ui.body}>
                    Admin receipt:{" "}
                    {value.receivedAt
                      ? dateLabel(value.receivedAt)
                      : "Not confirmed"}
                  </Text>
                  {value.resolvedAt && (
                    <>
                      <Badge value={value.resolution} />
                      <Text style={ui.muted}>
                        Resolved: {dateLabel(value.resolvedAt)}
                      </Text>
                    </>
                  )}
                </Card>
                {active && !value.reportedAt && (
                  <Card title="Waiting for rider">
                    <Text style={ui.body}>
                      The rider must physically return the parcel and report the
                      warehouse return before you can confirm receipt.
                    </Text>
                  </Card>
                )}
                {active && value.reportedAt && !value.receivedAt && (
                  <Card title="Confirm physical receipt">
                    <Text style={ui.body}>
                      Only confirm after receiving this parcel at the warehouse.
                    </Text>
                    <Button
                      title="Confirm warehouse receipt"
                      icon="check"
                      disabled={locked}
                      onPress={() =>
                        confirm(
                          "Parcel received?",
                          "Confirm only after checking the returned parcel at the warehouse.",
                          () =>
                            op.run(
                              () =>
                                adminRequest(
                                  session.accessToken,
                                  `${path}/warehouse-receipt`,
                                  {
                                    method: "PATCH",
                                    values: { attemptId: value.attemptId },
                                  },
                                ),
                              "Warehouse receipt confirmed.",
                            ),
                        )
                      }
                    />
                  </Card>
                )}
                {active && value.receivedAt && (
                  <Card title="Resolve returned delivery">
                    <Choice
                      label="Rider for another delivery"
                      value={riderId}
                      options={(riders.data || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                      onChange={setRiderId}
                      disabled={locked}
                    />
                    <Button
                      title="Arrange delivery retry"
                      icon="truck"
                      disabled={locked || !riderId}
                      onPress={() =>
                        confirm(
                          "Arrange another delivery?",
                          "The order will return to Confirmed with the selected rider. Dispatch it again after handing over the parcel.",
                          () =>
                            op.run(
                              () =>
                                adminRequest(
                                  session.accessToken,
                                  `${path}/resolution`,
                                  {
                                    method: "POST",
                                    values: {
                                      attemptId: value.attemptId,
                                      action: "RETRY",
                                      riderId,
                                    },
                                  },
                                ),
                              "Delivery retry arranged. Dispatch the order when ready.",
                            ),
                        )
                      }
                    />
                    <Button
                      title="Cancel order and restore stock"
                      icon="close"
                      danger
                      disabled={locked}
                      onPress={() =>
                        confirm(
                          "Cancel returned order?",
                          "This cancels the order and restores its stock. It does not issue a payment refund.",
                          () =>
                            op.run(
                              () =>
                                adminRequest(
                                  session.accessToken,
                                  `${path}/resolution`,
                                  {
                                    method: "POST",
                                    values: {
                                      attemptId: value.attemptId,
                                      action: "CANCEL",
                                      riderId: null,
                                    },
                                  },
                                ),
                              "Order cancelled and stock restored.",
                            ),
                          true,
                        )
                      }
                    />
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </Form>
    </Page>
  );
}
export default function LogisticsModule({
  session,
  onClose,
  onChanged,
  onOpenOrder,
}) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [editor, setEditor] = useState(null);
  const [warehouse, setWarehouse] = useState(null);
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  const result = useAdminResource(
    session.accessToken,
    `/deliveries?page=${page}&size=15&status=${status}`,
    revision,
  );
  if (warehouse)
    return (
      <Warehouse
        session={session}
        delivery={warehouse}
        onClose={onClose}
        onBack={() => {
          setWarehouse(null);
          refresh();
        }}
        onChanged={() => {
          refresh();
          onChanged();
        }}
      />
    );
  return (
    <Page
      title={editor ? "Delivery details" : "Deliveries & warehouse"}
      busy={op.busy}
      onClose={onClose}
      onBack={
        editor
          ? () => {
              op.reset();
              setEditor(null);
            }
          : undefined
      }
      onRefresh={
        !editor
          ? () => {
              op.reset();
              refresh();
            }
          : undefined
      }
    >
      {editor ? (
        <DeliveryEditor
          key={editor.orderId}
          delivery={editor}
          op={op}
          onSave={(values) =>
            op.run(
              () => {
                check(
                  values.name.trim() &&
                    values.addressLine.trim() &&
                    values.city.trim(),
                  "Enter the recipient, address and city.",
                );
                check(
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()),
                  "Enter a valid email address.",
                );
                check(
                  /^\d{11}$/.test(values.phone),
                  "Enter an 11-digit phone number.",
                );
                return adminRequest(
                  session.accessToken,
                  `/deliveries/${editor.orderId}/details`,
                  {
                    method: "PATCH",
                    values: Object.fromEntries(
                      Object.entries(values).map(([key, value]) => [
                        key,
                        value.trim(),
                      ]),
                    ),
                  },
                );
              },
              "Delivery details saved.",
              () => setEditor(null),
            )
          }
        />
      ) : (
        <>
          <View style={ui.toolbar}>
            <Notice op={op} />
            <Choice
              label="Delivery status"
              value={status}
              options={[
                "ALL",
                "CONFIRMED",
                "DISPATCHED",
                "DELIVERED",
                "CANCELLED",
                "RETURNED",
              ].map((value) => ({ value, label: readable(value) }))}
              onChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            />
          </View>
          <PagedList
            result={result}
            page={page}
            onPage={setPage}
            search={search}
            onSearch={setSearch}
            filter={(item) => status === "ALL" || item.status === status}
            renderItem={(delivery) => (
              <Card
                title={delivery.orderNumber}
                subtitle={delivery.customerName}
              >
                <Badge value={delivery.status} />
                <Text style={ui.body}>{delivery.address}</Text>
                <Text style={ui.body}>{delivery.phone}</Text>
                <Text style={ui.body}>
                  Rider: {delivery.riderName || "Not assigned"}
                  {delivery.riderId && !delivery.riderEnabled
                    ? " (disabled)"
                    : ""}
                </Text>
                {delivery.failureReason && (
                  <View style={ui.info}>
                    <Text style={ui.body}>
                      Last failure: {readable(delivery.failureReason)}
                    </Text>
                    <Text style={ui.muted}>{delivery.failureNote}</Text>
                  </View>
                )}
                <View style={ui.row}>
                  <Button
                    title={
                      ["DELIVERED", "CANCELLED", "RETURNED"].includes(
                        delivery.status,
                      )
                        ? "View details & history"
                        : "Manage order"
                    }
                    icon="box"
                    secondary
                    disabled={op.busy}
                    onPress={() => onOpenOrder(delivery.orderId)}
                  />
                  {!["DELIVERED", "CANCELLED", "RETURNED"].includes(
                    delivery.status,
                  ) &&
                    delivery.canEditDetails && (
                      <Button
                        title="Edit address"
                        icon="edit"
                        secondary
                        disabled={op.blocked}
                        onPress={() => {
                          op.reset();
                          setEditor(delivery);
                        }}
                      />
                    )}
                  {delivery.status === "DISPATCHED" &&
                    delivery.failureReason && (
                      <Button
                        title="Warehouse return"
                        icon="return"
                        secondary
                        disabled={op.busy}
                        onPress={() => setWarehouse(delivery)}
                      />
                    )}
                </View>
              </Card>
            )}
          />
        </>
      )}
    </Page>
  );
}
