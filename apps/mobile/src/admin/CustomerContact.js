import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { adminRequest } from "./adminApi";
import { Button, Card, Field, Form, Page, ui } from "./adminUi";
import { customerContactUrl, customerMessage } from "./contactMessages";

export default function CustomerContact({
  session,
  item,
  mode,
  onClose,
  onUpdateDetails,
  onInstructionsSent,
}) {
  const needsWarehouse = mode === "return" && item.status !== "REJECTED";
  const [warehouse, setWarehouse] = useState("");
  const [addressReady, setAddressReady] = useState(!needsWarehouse);
  const [contact, setContact] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const key = `shopmart.admin.warehouse-address.${session.user.id}`;
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
      AsyncStorage.getItem(key)
        .then((value) => {
          if (active) setWarehouse(value || "");
        })
        .catch(() => {
          if (active)
            setError(
              "Could not load the saved warehouse address. Please enter it again.",
            );
        })
        .finally(() => {
          if (active) setAddressReady(true);
        });
    return () => {
      active = false;
      controller.abort();
    };
  }, [session.accessToken, orderId, mode, key, needsWarehouse]);
  function build() {
    return customerMessage({
      mode,
      orderNumber: contact.orderNumber,
      customerName: contact.delivery?.name,
      productName: item.productName,
      returnId: item.id,
      status: item.status,
      warehouse,
      rejectionReason: item.rejectionReason,
    });
  }
  async function save() {
    setError("");
    setNotice("");
    if (warehouse.trim().length < 10) {
      setError(
        "Enter the complete warehouse address, city and contact information.",
      );
      return;
    }
    try {
      await AsyncStorage.setItem(key, warehouse.trim());
      setNotice("Warehouse return address saved on this phone.");
    } catch {
      setError("Unable to save the address. Please try again.");
    }
  }
  async function compose(channel) {
    if (busy || !contact) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = build();
      const url = customerContactUrl(
        channel,
        channel === "email" ? email : phone,
        `ShopMart ${mode === "return" ? "return instructions" : "delivery verification"} — ${contact.orderNumber}`,
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
      title={mode === "return" ? "Return instructions" : "Contact customer"}
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
        {notice ? <Text style={ui.success}>{notice}</Text> : null}
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
                subtitle="Enter the complete address, city and warehouse contact details."
              >
                <Field
                  label="Return parcels to"
                  multiline
                  value={warehouse}
                  onChangeText={setWarehouse}
                  editable={addressReady && !busy}
                  maxLength={1500}
                />
                <Button
                  title="Save warehouse address"
                  icon="check"
                  secondary
                  onPress={save}
                  disabled={!addressReady || busy}
                />
              </Card>
            )}
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
