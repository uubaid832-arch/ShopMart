import { Text } from "../i18n/LocalizedNativeComponents.js";
import { useRef, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { adminRequest, dateLabel, money, useAdminResource } from "./adminApi";
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
import ProductDiscountsModule from "./ProductDiscountsModule";
function VoucherEditor({ op, onSave, initialValues, editing }) {
  const requestId = useRef(Crypto.randomUUID());
  const [form, setForm] = useState(initialValues || {
    code: `SHOP-${Crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    kind: "PERCENT",
    value: "10",
    minSubtotal: "1000",
    maxDiscount: "",
    usageLimit: "100",
    perUserLimit: "1",
    validDays: "30",
  });
  function field(key, label, keyboardType = "decimal-pad") {
    return (
      <Field
        key={key}
        label={label}
        value={form[key]}
        onChangeText={(value) =>
          setForm({
            ...form,
            [key]: key === "code" ? value.toUpperCase() : value,
          })
        }
        keyboardType={keyboardType}
        editable={!op.blocked}
        maxLength={key === "code" ? 40 : 15}
      />
    );
  }
  return (
    <Form>
      <Notice op={op} />
      <Card
        title={editing ? "Edit voucher" : "Generate a voucher"}
        subtitle="Codes work on both website and mobile checkout."
      >
        {field("code", "Voucher code", "default")}
        {!editing && <Button
          title="Generate another code"
          secondary
          disabled={op.blocked}
          onPress={() =>
            setForm({
              ...form,
              code: `SHOP-${Crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            })
          }
        />}
        <Choice
          label="Discount type"
          value={form.kind}
          onChange={(kind) => setForm({ ...form, kind })}
          disabled={op.blocked}
          options={[
            { value: "PERCENT", label: "Percentage discount" },
            { value: "FIXED", label: "Fixed amount in PKR" },
          ]}
        />
        {field(
          "value",
          form.kind === "PERCENT"
            ? "Discount percentage (up to 99%)"
            : "Discount amount (PKR)",
        )}
        {field("minSubtotal", "Minimum product subtotal (PKR)")}
        {field("maxDiscount", "Maximum discount (PKR, optional)")}
        {field("usageLimit", "Total allowed uses", "number-pad")}
        {field("perUserLimit", "Uses per customer", "number-pad")}
        {field("validDays", "Valid for (days)", "number-pad")}
        <Text style={ui.muted}>
          Codes activate immediately. Cancellations do not restore used
          allowances.
        </Text>
        <Button
          title={editing ? "Save voucher" : "Create voucher"}
          icon="check"
          disabled={op.blocked}
          onPress={() =>
            onSave({
              ...form,
              ...(editing ? { id: form.id, version: form.version } : { requestId: requestId.current }),
              code: form.code.trim(),
              maxDiscount: form.maxDiscount.trim() || null,
              usageLimit: Number(form.usageLimit),
              perUserLimit: Number(form.perUserLimit),
              validDays: Number(form.validDays),
            })
          }
        />
      </Card>
    </Form>
  );
}
export default function VouchersModule({ session, onClose, onChanged }) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [tab, setTab] = useState("VOUCHERS");
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  const result = useAdminResource(
    session.accessToken,
    `/vouchers?page=${page}&size=15`,
    revision,
  );
  return (
    <Page
      footerAction={
        !creating && tab === "VOUCHERS" ? (
          <Button
            title="Generate voucher"
            icon="plus"
            disabled={op.blocked}
            onPress={() => {
              op.reset();
              setCreating(true);
            }}
          />
        ) : null
      }
      title={creating ? (editingVoucher ? "Edit voucher" : "Create voucher") : tab === "PRODUCTS" ? "Product discounts" : "Vouchers & discounts"}
      onClose={onClose}
      busy={op.busy}
      onBack={
        creating
          ? () => {
              op.reset();
              setEditingVoucher(null);
              setCreating(false);
            }
          : undefined
      }
      onRefresh={
        !creating
          ? () => {
              op.reset();
              refresh();
            }
          : undefined
      }
    >
      {!creating && <View style={ui.toolbar}>
        <Button title="Voucher codes" secondary={tab !== "VOUCHERS"} onPress={() => setTab("VOUCHERS")} />
        <Button title="Product campaigns" secondary={tab !== "PRODUCTS"} onPress={() => setTab("PRODUCTS")} />
      </View>}
      {tab === "PRODUCTS" && !creating ? (
        <Form>
          <ProductDiscountsModule session={session} onChanged={onChanged} />
        </Form>
      ) : creating ? (
        <VoucherEditor
          key={editingVoucher?.id || "new-voucher"}
          op={op}
          editing={Boolean(editingVoucher)}
          initialValues={editingVoucher ? {
            id: editingVoucher.id,
            version: editingVoucher.version,
            code: editingVoucher.code,
            kind: editingVoucher.kind,
            value: String(editingVoucher.value),
            minSubtotal: String(editingVoucher.minSubtotal),
            maxDiscount: editingVoucher.maxDiscount == null ? "" : String(editingVoucher.maxDiscount),
            usageLimit: String(editingVoucher.usageLimit),
            perUserLimit: String(editingVoucher.perUserLimit),
            validDays: String(Math.min(3650, Math.max(1, Math.ceil((new Date(editingVoucher.expiresAt).getTime() - Date.now()) / 86400000)))),
          } : undefined}
          onSave={(values) =>
            op.run(
              () => {
                check(
                  /^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(values.code),
                  "Use a code of 3–40 letters, numbers, hyphens or underscores.",
                );
                check(
                  /^\d{1,10}(\.\d{1,2})?$/.test(values.value) &&
                    Number(values.value) > 0,
                  "Enter a positive discount value.",
                );
                check(
                  values.kind !== "PERCENT" || Number(values.value) <= 99,
                  "Percentage must be no more than 99%.",
                );
                check(
                  /^\d{1,10}(\.\d{1,2})?$/.test(values.minSubtotal),
                  "Enter a valid minimum subtotal.",
                );
                check(
                  !values.maxDiscount ||
                    (/^\d{1,10}(\.\d{1,2})?$/.test(values.maxDiscount) &&
                      Number(values.maxDiscount) > 0),
                  "Enter a positive maximum discount or leave it blank.",
                );
                check(
                  Number.isInteger(values.usageLimit) &&
                    values.usageLimit >= 1 &&
                    values.usageLimit <= 1000000 &&
                    Number.isInteger(values.perUserLimit) &&
                    values.perUserLimit >= 1 &&
                    values.perUserLimit <= values.usageLimit,
                  "Check the total and per-customer usage limits.",
                );
                check(
                  Number.isInteger(values.validDays) &&
                    values.validDays >= 1 &&
                    values.validDays <= 3650,
                  "Validity must be 1–3650 days.",
                );
                const { id, version, requestId, ...fields } = values;
                const isEditing = Boolean(id);
                return adminRequest(session.accessToken, isEditing ? `/vouchers/${id}` : "/vouchers", {
                  method: isEditing ? "PUT" : "POST",
                  values: { ...fields, ...(isEditing ? { version } : { requestId }) },
                });
              },
              editingVoucher ? "Voucher updated." : "Voucher created.",
              () => { setCreating(false); setEditingVoucher(null); },
            )
          }
        />
      ) : (
        <>
          <PagedList
            filter={(item) =>
              filter === "ALL" ||
              (filter === "DISABLED"
                ? !item.enabled
                : filter === "ACTIVE"
                  ? item.enabled &&
                    new Date(item.expiresAt) > new Date() &&
                    item.used < item.usageLimit
                  : new Date(item.expiresAt) <= new Date() ||
                    item.used >= item.usageLimit)
            }
            toolbar={
              <View style={ui.toolbar}>
                <Notice op={op} />
                <Choice
                  compact
                  label="Voucher status"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "ALL", label: "All vouchers" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "DISABLED", label: "Disabled" },
                    { value: "EXPIRED", label: "Expired / used up" },
                  ]}
                />
              </View>
            }
            result={result}
            page={page}
            onPage={setPage}
            search={search}
            onSearch={setSearch}
            renderItem={(item) => (
              <Card>
                <Text selectable style={ui.title}>
                  {item.code}
                </Text>
                <Text style={ui.amount}>
                  {item.kind === "PERCENT"
                    ? `${Number(item.value)}% off`
                    : `${money(item.value)} off`}
                </Text>
                <Badge
                  value={
                    !item.enabled
                      ? "Disabled"
                      : new Date(item.expiresAt) <= new Date()
                        ? "Expired"
                        : item.used >= item.usageLimit
                          ? "Used up"
                          : "Active"
                  }
                />
                <Text style={ui.body}>
                  Minimum spend: {money(item.minSubtotal)}
                </Text>
                {item.maxDiscount && (
                  <Text style={ui.body}>
                    Maximum saving: {money(item.maxDiscount)}
                  </Text>
                )}
                <Text style={ui.body}>
                  {item.used} / {item.usageLimit} uses · {item.perUserLimit} per
                  customer
                </Text>
                <Text style={ui.muted}>
                  Expires {dateLabel(item.expiresAt)}
                </Text>
                <Button title="Edit voucher" secondary disabled={op.blocked} onPress={() => { op.reset(); setEditingVoucher(item); setCreating(true); }} />
                <Button
                  title={item.enabled ? "Disable voucher" : "Enable voucher"}
                  danger={item.enabled}
                  secondary={!item.enabled}
                  disabled={op.blocked}
                  onPress={() =>
                    confirm(
                      item.enabled ? "Disable voucher?" : "Enable voucher?",
                      "Existing orders keep their discount. Expired or fully used codes remain ineligible.",
                      () =>
                        op.run(
                          () =>
                            adminRequest(
                              session.accessToken,
                              `/vouchers/${item.id}`,
                              {
                                method: "PATCH",
                                values: {
                                  enabled: !item.enabled,
                                  version: item.version,
                                },
                              },
                            ),
                          "Voucher status updated.",
                        ),
                      item.enabled,
                    )
                  }
                />
                {!item.enabled && (
                  <Button
                    title="Delete disabled voucher"
                    danger
                    disabled={op.blocked}
                    onPress={() =>
                      confirm(
                        "Delete this disabled voucher?",
                        item.used > 0
                          ? "This voucher has already been used, so it must remain for order history."
                          : "This permanently removes the disabled voucher.",
                        () =>
                          op.run(
                            () =>
                              adminRequest(
                                session.accessToken,
                                `/vouchers/${item.id}`,
                                { method: "DELETE" },
                              ),
                            "Voucher deleted.",
                          ),
                        true,
                      )
                    }
                  />
                )}
              </Card>
            )}
          />
        </>
      )}
    </Page>
  );
}
