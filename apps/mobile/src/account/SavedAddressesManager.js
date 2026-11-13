import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

async function request(token, method = "GET", id, values) {
  const response = await fetch(`${baseUrl}/api/mobile/addresses${id ? `/${id}` : ""}`, {
    method,
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(values ? { "Content-Type": "application/json" } : {}),
    },
    body: values ? JSON.stringify(values) : undefined,
  });
  if (!response.ok) {
    let detail;
    try { detail = await response.json(); } catch { /* Use the safe fallback. */ }
    throw new Error(detail?.message || `Address update failed (HTTP ${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

const empty = { label: "Home", customLabel: "", recipientName: "", phone: "", addressLine: "", city: "", postalCode: "", country: "Pakistan", isDefault: false };

export default function SavedAddressesManager({ token }) {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    request(token).then((data) => { if (active) setItems(data); })
      .catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [token, revision]);

  const field = (key, label, multiline = false) => (
    <TextInput
      key={key}
      accessibilityLabel={label}
      placeholder={label}
      value={form[key]}
      onChangeText={(value) => setForm((current) => ({ ...current, [key]: key === "phone" ? value.replace(/\D/g, "") : value }))}
      keyboardType={key === "phone" ? "phone-pad" : "default"}
      multiline={multiline}
      maxLength={key === "addressLine" ? 250 : key === "phone" ? 32 : 100}
      style={[styles.input, multiline && styles.multiline]}
    />
  );

  async function save() {
    if (busy || !form) return;
    const label = form.label === "Other" ? form.customLabel.trim() : form.label;
    if (!label || !form.recipientName.trim() || !form.phone.trim() || !form.addressLine.trim() || !form.city.trim()) {
      setError("Complete the address label, recipient, phone, street and city.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const values = { label, recipientName: form.recipientName.trim(), phone: form.phone.trim(), addressLine: form.addressLine.trim(), city: form.city.trim(), postalCode: form.postalCode.trim(), country: "Pakistan", isDefault: form.isDefault };
      await request(token, form.id ? "PUT" : "POST", form.id, values);
      setForm(null); setNotice("Address saved."); setRevision((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function remove(item) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await request(token, "DELETE", item.id); setNotice("Address deleted."); setRevision((value) => value + 1); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Saved addresses</Text>
      {items === null ? <ActivityIndicator color="#7c3aed" /> : items.map((item) => (
        <View key={item.id} style={styles.address}>
          <Text style={styles.addressTitle}>{item.label}{item.isDefault ? " · Default" : ""}</Text>
          <Text style={styles.copy}>{item.recipientName} · {item.phone}</Text>
          <Text style={styles.copy}>{item.addressLine}, {item.city}{item.postalCode ? ` ${item.postalCode}` : ""}</Text>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setForm({ ...item, customLabel: ["Home", "Office", "Other"].includes(item.label) ? "" : item.label, label: ["Home", "Office", "Other"].includes(item.label) ? item.label : "Other" })}><Text style={styles.link}>Edit</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => remove(item)}><Text style={styles.danger}>Delete</Text></Pressable>
          </View>
        </View>
      ))}
      {form ? (
        <View style={styles.form}>
          <Text style={styles.copy}>Address label</Text>
          <View style={styles.row}>
            {["Home", "Office", "Other"].map((label) => <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: form.label === label }} onPress={() => setForm({ ...form, label })} style={[styles.choice, form.label === label && styles.selected]}><Text style={styles.choiceText}>{label}</Text></Pressable>)}
          </View>
          {form.label === "Other" && <TextInput accessibilityLabel="Custom address label" placeholder="Custom label" value={form.customLabel} onChangeText={(value) => setForm({ ...form, customLabel: value })} maxLength={80} style={styles.input} />}
          {field("recipientName", "Recipient name")}{field("phone", "Phone number")}{field("addressLine", "Street address", true)}{field("city", "City")}{field("postalCode", "Postal code (optional)")}
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.isDefault }} onPress={() => setForm({ ...form, isDefault: !form.isDefault })} style={styles.row}><Text style={styles.copy}>{form.isDefault ? "☑" : "☐"} Use as default</Text></Pressable>
          <View style={styles.row}><Pressable disabled={busy} onPress={save} style={styles.primary}><Text style={styles.primaryText}>{busy ? "Saving…" : "Save address"}</Text></Pressable><Pressable disabled={busy} onPress={() => setForm(null)} style={styles.choice}><Text style={styles.choiceText}>Cancel</Text></Pressable></View>
        </View>
      ) : <Pressable disabled={busy} onPress={() => setForm({ ...empty })} style={styles.primary}><Text style={styles.primaryText}>+ Add address</Text></Pressable>}
      {error ? <Text accessibilityRole="alert" style={styles.danger}>{error}</Text> : null}
      {notice ? <Text style={styles.link}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 22, padding: 15, borderRadius: 16, backgroundColor: "#faf8ff", gap: 9 },
  heading: { color: "#17203c", fontSize: 17, fontWeight: "800", marginBottom: 3 },
  address: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e5def4", backgroundColor: "#fff", gap: 5 },
  addressTitle: { color: "#6d28d9", fontWeight: "800" },
  copy: { color: "#596579", fontSize: 12, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 7 },
  form: { gap: 8, marginTop: 4 },
  input: { width: "100%", borderWidth: 1, borderColor: "#e5def4", borderRadius: 11, backgroundColor: "#fff", padding: 12, color: "#25304a" },
  multiline: { minHeight: 68, textAlignVertical: "top" },
  choice: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5def4" },
  selected: { borderColor: "#7c3aed", backgroundColor: "#ede9fe" },
  choiceText: { color: "#6d28d9", fontWeight: "700" },
  primary: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 11, backgroundColor: "#7c3aed" },
  primaryText: { color: "#fff", fontWeight: "800" },
  link: { color: "#6d28d9", fontWeight: "700", paddingVertical: 6 },
  danger: { color: "#be123c", fontWeight: "700", paddingVertical: 6 },
});
