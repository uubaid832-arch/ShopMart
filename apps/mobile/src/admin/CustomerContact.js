import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { adminRequest } from "./adminApi";
import { Button, Card, Choice, Field, Form, Page, ui } from "./adminUi";
import { customerContactUrl, customerMessage } from "./contactMessages";

export default function CustomerContact({
  session,
  item,
  mode,
  onClose,
  onUpdateDetails,
  onInstructionsSent,
}) {
  const [refundChoice, setRefundChoice] = useState("ACCOUNT");
  const needsWarehouse = mode === "return" && item.status !== "REJECTED";
  const [warehouse, setWarehouse] = useState("");
  const [addressReady, setAddressReady] = useState(!needsWarehouse);
  const [contact, setContact] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const orderId = item.orderId || item.id;
  useEffect(() => {
    const controller = new AbortController();
    adminRequest(
      session.accessToken,
      `/orders/${encodeURIComponent(orderId)}`,
      { signal: controller.signal },
    )
      .then((order) => {
        if (!controller.signal.aborted) {
          setContact(order);
          setEmail(order.delivery?.email || "");
          setPhone(order.delivery?.phone || "");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    let active = true;
    if (needsWarehouse)
      adminRequest(session.accessToken, "/settings/warehouse-address", {
        signal: controller.signal,
      })
        .then((result) => {
          if (active) setWarehouse(result.address || "");
        })
        .catch((failure) => {
          if (active && failure.name !== "AbortError") setError(failure.message);
        })
        .finally(() => {
          if (active) setAddressReady(true);
        });
    return () => {
      active = false;
      controller.abort();
    };
  }, [session.accessToken, orderId, mode, needsWarehouse]);
  function build() {
    return customerMessage({
      mode,
      orderNumber: contact.orderNumber,
      customerName: contact.delivery?.name,
      productName: item.productName,
      returnId: item.id,
      status: item.status,
      warehouse,
      refundChoice,
      rejectionReason: item.rejectionReason,
    });
  }
  async function compose(channel) {
    if (busy || !contact) return;
    setBusy(true);
    setError("");
    try {
      const body = build();
      const url = customerContactUrl(
        channel,
        channel === "email" ? email : phone,
        `ShopMart ${mode === "refund" ? "refund preference" : mode === "return" ? "return instructions" : "delivery verification"} — ${contact.orderNumber}`,
        body,
      );
      await Linking.openURL(url);
    } catch (failure) {
      setError(
        failure.message ||
          "Unable to open the contact app. Install an email app or WhatsApp and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  let preview = "";
  if (contact && (!needsWarehouse || warehouse.trim().length >= 10))
    preview = build();
  return (
    <Page
      title={mode === "refund" ? "Refund follow-up" : mode === "return" ? "Return instructions" : "Contact customer"}
      onClose={onClose}
      onBack={onClose}
      busy={busy}
    >
      <Form>
        {error ? (
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
        ) : null}
        {!contact ? (
          <ActivityIndicator color="#7c3aed" />
        ) : (
          <>
            <Card title={contact.orderNumber} subtitle={contact.delivery?.name}>
              <Field
                label="Customer email (message recipient)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!busy}
              />
              <Field
                label="Customer WhatsApp number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!busy}
              />
              <Text style={ui.muted}>
                Recipient changes here apply only to this draft.
              </Text>
              {onUpdateDetails && (
                <Button
                  title="Verify & update delivery details"
                  icon="edit"
                  secondary
                  onPress={onUpdateDetails}
                  disabled={busy}
                />
              )}
            </Card>
            {needsWarehouse && (
              <Card
                title="Warehouse return address"
                subtitle="This saved ShopMart address appears in the customer instructions."
              >
                <Text style={ui.body} selectable>
                  {!addressReady
                    ? "Loading saved address…"
                    : warehouse || "No warehouse address saved. Add it from Admin My account."}
                </Text>
              </Card>
            )}
            {mode === "refund" && <Choice label="Refund follow-up" value={refundChoice} onChange={setRefundChoice} options={[{value:"ACCOUNT",label:"Ask account details / preference"},{value:"VOUCHER",label:"Offer future purchase voucher"}]} />}
            {preview ? (
              <Card title="Message preview">
                <Text selectable style={ui.body}>
                  {preview}
                </Text>
              </Card>
            ) : null}
            <View style={ui.row}>
              <Button
                title="Email customer"
                icon="mail"
                onPress={() => compose("email")}
                disabled={
                  busy ||
                  !addressReady ||
                  (needsWarehouse && warehouse.trim().length < 10)
                }
              />
              <Button
                title="WhatsApp"
                icon="chat"
                secondary
                onPress={() => compose("whatsapp")}
                disabled={
                  busy ||
                  !addressReady ||
                  (needsWarehouse && warehouse.trim().length < 10)
                }
              />
            </View>
            <Text style={ui.muted}>
              Review the draft and send it in your email or WhatsApp app.
            </Text>
            {onInstructionsSent && (
              <Card title="After sending the instructions">
                <Text style={ui.body}>
                  Only confirm after you have actually sent the message to the
                  customer.
                </Text>
                <Button
                  title="Confirm instructions sent"
                  icon="check"
                  disabled={
                    busy || !addressReady || warehouse.trim().length < 10
                  }
                  onPress={async () => {
                    setBusy(true);
                    try {
                      const saved = await onInstructionsSent();
                      if (!saved)
                        setError(
                          "Unable to record contact. Close this screen and refresh before retrying.",
                        );
                    } catch (failure) {
                      setError(failure.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </Card>
            )}
          </>
        )}
      </Form>
    </Page>
  );
}
