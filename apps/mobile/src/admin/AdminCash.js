import { useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
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

function CashDetails({ session, id, onClose, onBack, onChanged }) {
  const [revision, setRevision] = useState(0);
  const [note, setNote] = useState("");
  const [counted, setCounted] = useState(false);
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  const result = useAdminResource(
    session.accessToken,
    `/cod/handovers/${id}`,
    revision,
  );
  const value = result.data?.handover;
  function decide(status) {
    confirm(
      status === "CONFIRMED" ? "Confirm cash received?" : "Reject handover?",
      status === "CONFIRMED"
        ? `Confirm you physically received and counted ${money(value.amount, value.currency)} from ${value.riderName}.`
        : `Reject this report from ${value.riderName}? The rider can correct it and submit again.`,
      () =>
        op.run(
          () => {
            check(
              status !== "CONFIRMED" || counted,
              "Confirm that you counted and received the cash.",
            );
            check(
              status !== "REJECTED" || note.trim(),
              "Explain why the handover is being rejected.",
            );
            return adminRequest(session.accessToken, `/cod/handovers/${id}`, {
              method: "PATCH",
              values: { status, note: note.trim() },
            });
          },
          status === "CONFIRMED"
            ? "Cash handover confirmed."
            : "Cash handover rejected.",
        ),
      status === "REJECTED",
    );
  }
  return (
    <Page
      title="COD handover details"
      busy={op.busy}
      onClose={onClose}
      onBack={onBack}
      onRefresh={() => {
        op.reset();
        refresh();
      }}
    >
      <Form>
        <Notice op={op} />
        {result.loading ? (
          <ActivityIndicator size="large" color="#7c3aed" style={ui.loader} />
        ) : result.error ? (
          <Text style={ui.error}>{result.error}</Text>
        ) : (
          value && (
            <>
              <Card
                title={value.riderName}
                subtitle={dateLabel(value.createdAt)}
              >
                <Text style={ui.amount}>
                  {money(value.amount, value.currency)}
                </Text>
                <Badge value={value.status} />
                {value.note ? (
                  <Text style={ui.body}>Rider note: {value.note}</Text>
                ) : null}
                <Text selectable style={ui.muted}>
                  Report: {value.id}
                </Text>
              </Card>
              <Card
                title="Included COD collections"
                subtitle={`${result.data.collections.length} collected orders`}
              >
                {result.data.collections.map((item) => (
                  <View key={item.id} style={ui.divider}>
                    <View style={ui.between}>
                      <Text style={[ui.body, ui.grow]}>{item.orderNumber}</Text>
                      <Text style={ui.link}>
                        {money(item.amount, item.currency)}
                      </Text>
                    </View>
                    <Text style={ui.muted}>{dateLabel(item.collectedAt)}</Text>
                  </View>
                ))}
              </Card>
              {value.status === "PENDING" ? (
                <Card title="Check the physical cash">
                  <Text style={ui.body}>
                    The rider's report alone does not confirm receipt. Count the
                    cash before confirming this amount.
                  </Text>
                  <Field
                    label="Admin note / rejection reason"
                    value={note}
                    onChangeText={setNote}
                    multiline
                    maxLength={500}
                    editable={!op.blocked}
                  />
                  <View style={ui.switchRow}>
                    <Text style={[ui.body, ui.grow]}>
                      I counted and received{" "}
                      {money(value.amount, value.currency)}.
                    </Text>
                    <Switch
                      accessibilityLabel="Cash counted and received"
                      value={counted}
                      onValueChange={setCounted}
                      disabled={op.blocked}
                    />
                  </View>
                  <Button
                    title="Confirm cash received"
                    icon="check"
                    disabled={op.blocked || !counted}
                    onPress={() => decide("CONFIRMED")}
                  />
                  <Button
                    title="Reject handover"
                    icon="close"
                    danger
                    disabled={op.blocked || !note.trim()}
                    onPress={() => decide("REJECTED")}
                  />
                </Card>
              ) : (
                <Card title="Decision recorded">
                  <Text style={ui.body}>
                    {value.adminName || "Administrator"} ·{" "}
                    {dateLabel(value.decidedAt)}
                  </Text>
                  <Text style={ui.body}>
                    {value.decisionNote || "No decision note."}
                  </Text>
                  <Text style={ui.muted}>
                    This report has a final decision and cannot be changed here.
                  </Text>
                </Card>
              )}
            </>
          )
        )}
      </Form>
    </Page>
  );
}
export default function CashModule({ session, onClose, onChanged }) {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("PENDING");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const refresh = () => setRevision((v) => v + 1);
  const result = useAdminResource(
    session.accessToken,
    `/cod/handovers?status=${status}&page=${page}&size=15`,
    revision,
  );
  if (selected)
    return (
      <CashDetails
        session={session}
        id={selected}
        onClose={onClose}
        onBack={() => {
          setSelected(null);
          refresh();
        }}
        onChanged={() => {
          refresh();
          onChanged();
        }}
      />
    );
  return (
    <Page title="COD cash handovers" onClose={onClose} onRefresh={refresh}>
      <View style={ui.toolbar}>
        <Choice
          label="Handover status"
          value={status}
          options={["PENDING", "CONFIRMED", "REJECTED", "ALL"].map((value) => ({
            value,
            label: readable(value),
          }))}
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
        renderItem={(item) => (
          <Card title={item.riderName} subtitle={dateLabel(item.createdAt)}>
            <Text style={ui.amount}>{money(item.amount, item.currency)}</Text>
            <Badge value={item.status} />
            {item.note ? <Text style={ui.body}>{item.note}</Text> : null}
            <Button
              title={
                item.status === "PENDING"
                  ? "Review cash handover"
                  : "View handover"
              }
              icon="wallet"
              secondary
              onPress={() => setSelected(item.id)}
            />
          </Card>
        )}
      />
    </Page>
  );
}
