import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { adminRequest } from "./adminApi";
import { Button, Card, Field, Form, Page, ui } from "./adminUi";

export default function AdminWarehouseAddress({ session, onClose }) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    adminRequest(session.accessToken, "/settings/warehouse-address", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setAddress(result.address || "");
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session.accessToken]);

  async function save() {
    if (pending.current) return;
    if (address.trim().length < 10) {
      setError("Enter the full warehouse address, city, and contact details.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await adminRequest(
        session.accessToken,
        "/settings/warehouse-address",
        { method: "PUT", values: { address: address.trim() } },
      );
      setAddress(saved.address);
      setNotice("Warehouse address saved. New return instructions will use it.");
    } catch (failure) {
      setError(failure.message || "Could not save the warehouse address.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <Page title="Warehouse return address" onClose={onClose} busy={saving}>
      <Form>
        <Card
          title="Address for returned goods"
          subtitle="Customers will see this address in return instructions."
        >
          {loading ? (
            <ActivityIndicator color="#7c3aed" />
          ) : (
            <>
              <Field
                label="Warehouse address, city, and contact details"
                value={address}
                onChangeText={(value) => {
                  setAddress(value);
                  setError("");
                  setNotice("");
                }}
                multiline
                maxLength={1500}
                editable={!saving}
              />
              <Text style={ui.muted}>
                Include the street, area, city, and a phone number customers can
                use for return delivery.
              </Text>
              {error ? (
                <Text accessibilityRole="alert" style={ui.error}>
                  {error}
                </Text>
              ) : null}
              {notice ? <Text style={ui.success}>{notice}</Text> : null}
              <Button
                title={saving ? "Saving address…" : "Save warehouse address"}
                icon="check"
                disabled={saving || loading}
                onPress={save}
              />
            </>
          )}
        </Card>
      </Form>
    </Page>
  );
}
