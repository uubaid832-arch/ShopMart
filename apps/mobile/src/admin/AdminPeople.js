import { useState } from "react";
import { Text, View } from "react-native";
import { adminRequest, useAdminResource } from "./adminApi";
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

function RiderForm({ op, onSave }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  return (
    <Form>
      <Notice op={op} />
      <Card
        title="Create a rider account"
        subtitle="Use the rider's real email address. Rider sign-in requires an email OTP."
      >
        <Field
          label="Full name"
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
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={32}
          editable={!op.blocked}
        />
        <Field
          label="Initial password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          maxLength={72}
          editable={!op.blocked}
        />
        <Field
          label="Confirm password"
          value={again}
          onChangeText={setAgain}
          secureTextEntry
          autoCapitalize="none"
          maxLength={72}
          editable={!op.blocked}
        />
        <Button
          title="Create rider"
          icon="plus"
          disabled={op.blocked}
          onPress={() => onSave({ name, email, phone, password }, again)}
        />
      </Card>
    </Form>
  );
}
function ResetForm({ user, op, onSave }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  return (
    <Form>
      <Notice op={op} />
      <Card
        title={`Reset password for ${user.name}`}
        subtitle="Existing refresh sessions will be revoked. The rider must sign in again with the new password and email OTP."
      >
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          maxLength={72}
          editable={!op.blocked}
        />
        <Field
          label="Confirm new password"
          value={again}
          onChangeText={setAgain}
          secureTextEntry
          autoCapitalize="none"
          maxLength={72}
          editable={!op.blocked}
        />
        <Button
          title="Reset rider password"
          icon="check"
          disabled={op.blocked}
          onPress={() =>
            confirm(
              "Reset rider password?",
              "This changes the rider's password and revokes their refresh sessions.",
              () => onSave(password, again),
              true,
            )
          }
        />
      </Card>
    </Form>
  );
}
export default function PeopleModule({ session, onClose, onChanged }) {
  const [page, setPage] = useState(0);
  const [role, setRole] = useState("ALL");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  const result = useAdminResource(
    session.accessToken,
    `/users?page=${page}&size=15&role=${role}&search=${encodeURIComponent(search)}`,
    revision,
  );
  return (
    <Page
      footerAction={
        !editor ? (
          <Button
            title="Add rider"
            icon="plus"
            disabled={op.blocked}
            onPress={() => {
              op.reset();
              setEditor("NEW");
            }}
          />
        ) : null
      }
      title={
        editor === "NEW"
          ? "Add rider"
          : editor
            ? "Reset rider password"
            : "Users & riders"
      }
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
      {editor === "NEW" ? (
        <RiderForm
          op={op}
          onSave={(values, again) =>
            op.run(
              () => {
                check(values.name.trim(), "Enter the rider's name.");
                check(
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()),
                  "Enter a valid email address.",
                );
                check(
                  values.password.length >= 8 && values.password === again,
                  "Use a password of at least eight characters and match both fields.",
                );
                return adminRequest(session.accessToken, "/users/riders", {
                  method: "POST",
                  values: {
                    ...values,
                    name: values.name.trim(),
                    email: values.email.trim(),
                    phone: values.phone.trim(),
                  },
                });
              },
              "Rider created.",
              () => setEditor(null),
            )
          }
        />
      ) : editor ? (
        <ResetForm
          user={editor}
          op={op}
          onSave={(password, again) =>
            op.run(
              () => {
                check(
                  password.length >= 8 && password === again,
                  "Use a password of at least eight characters and match both fields.",
                );
                return adminRequest(
                  session.accessToken,
                  `/users/${editor.id}/password`,
                  { method: "PATCH", values: { newPassword: password } },
                );
              },
              "Rider password reset.",
              () => setEditor(null),
            )
          }
        />
      ) : (
        <>
          <View style={ui.toolbar}>
            <Notice op={op} />

            <Field
              label="Search all users"
              value={draft}
              onChangeText={setDraft}
              placeholder="Name or email"
              autoCapitalize="none"
            />
            <View style={ui.row}>
              <Button
                title="Search"
                icon="search"
                secondary
                disabled={op.busy}
                onPress={() => {
                  setSearch(draft.trim());
                  setPage(0);
                }}
              />
              <Button
                title="Clear"
                secondary
                disabled={op.busy}
                onPress={() => {
                  setDraft("");
                  setSearch("");
                  setPage(0);
                }}
              />
            </View>
            <Choice
              label="Account role"
              value={role}
              options={["ALL", "CUSTOMER", "RIDER", "ADMIN"].map((value) => ({
                value,
                label: value === "ALL" ? "All accounts" : value,
              }))}
              onChange={(value) => {
                setRole(value);
                setPage(0);
              }}
              disabled={op.busy}
            />
          </View>
          <PagedList
            result={result}
            page={page}
            onPage={setPage}
            renderItem={(user) => (
              <Card title={user.name} subtitle={user.email}>
                <Text selectable style={ui.body}>
                  {user.phone || "No phone number"}
                </Text>
                <View style={ui.row}>
                  <Badge value={user.role} />
                  <Badge value={user.enabled ? "Enabled" : "Disabled"} />
                </View>
                {user.role !== "ADMIN" && (
                  <View style={ui.row}>
                    <Button
                      title={
                        user.enabled ? "Disable account" : "Enable account"
                      }
                      secondary={!user.enabled}
                      danger={user.enabled}
                      disabled={op.blocked}
                      onPress={() =>
                        confirm(
                          user.enabled ? "Disable account?" : "Enable account?",
                          user.enabled
                            ? "This prevents future sign-in and access. Riders with active deliveries must be resolved first."
                            : "Allow this account to access ShopMart again.",
                          () =>
                            op.run(
                              () =>
                                adminRequest(
                                  session.accessToken,
                                  `/users/${user.id}/enabled`,
                                  {
                                    method: "PATCH",
                                    values: {
                                      enabled: !user.enabled,
                                      version: user.version,
                                    },
                                  },
                                ),
                              "Account updated.",
                            ),
                          user.enabled,
                        )
                      }
                    />
                    {user.role === "RIDER" && (
                      <Button
                        title="Reset password"
                        secondary
                        disabled={op.blocked}
                        onPress={() => {
                          op.reset();
                          setEditor(user);
                        }}
                      />
                    )}
                  </View>
                )}
                {user.role === "ADMIN" && (
                  <Text style={ui.muted}>
                    Admin accounts are protected. Use My account to update your
                    own profile and password.
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
