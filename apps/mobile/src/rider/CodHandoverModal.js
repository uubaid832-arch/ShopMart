import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { codRequest, money } from "./codApi";

export default function CodHandoverModal({ session, onClose, onChanged }) {
  const token = session.accessToken;
  const [tab, setTab] = useState("report");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const pending = useRef(false);
  const snapshot = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const path = tab === "report" ? "/cod/collections" : "/cod/handovers";
    codRequest(
      token,
      `${path}?page=${page}&size=20`,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          const last = Math.max(0, data.totalPages - 1);
          if (page > last) {
            setPage(last);
            return;
          }
          setResult({ token, tab, page, reload, data, error: "" });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({ token, tab, page, reload, error: failure.message });
      });
    return () => controller.abort();
  }, [token, tab, page, reload]);
  useEffect(() => {
    if (!detailId) return;
    const controller = new AbortController();
    codRequest(
      token,
      `/cod/handovers/${detailId}`,
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted)
          setDetail({ token, id: detailId, data, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setDetail({ token, id: detailId, error: failure.message });
      });
    return () => controller.abort();
  }, [token, detailId]);
  const current =
    result?.token === token &&
    result?.tab === tab &&
    result?.page === page &&
    result?.reload === reload;
  const data = current ? result.data : null;
  const detailCurrent = detail?.token === token && detail?.id === detailId;
  const choices = Object.values(selected);
  const total = choices.reduce((sum, item) => sum + Number(item.amount), 0);

  function close() {
    if (pending.current) return;
    if (detailId) {
      setDetailId(null);
      return;
    }
    if (locked) {
      Alert.alert(
        "Handover result uncertain",
        "The report may already exist. Retry here with the same request ID, or close and check handover history before submitting another report.",
        [
          { text: "Stay here", style: "cancel" },
          { text: "Close and check later", onPress: onClose },
        ],
      );
    } else onClose();
  }
  function switchTab(value) {
    if (busy || locked) return;
    setTab(value);
    setPage(0);
    setError("");
  }
  function toggle(item) {
    if (busy || locked) return;
    setSelected((current) => {
      const next = { ...current };
      if (next[item.id]) delete next[item.id];
      else if (Object.keys(next).length < 100) next[item.id] = item;
      return next;
    });
    setError("");
  }
  async function submit() {
    if (pending.current) return;
    if (!snapshot.current) {
      if (!choices.length) {
        setError("Select the collected orders whose cash you handed over.");
        return;
      }
      snapshot.current = {
        requestId: Crypto.randomUUID(),
        collectionIds: choices.map((item) => item.id),
        note: note.trim(),
      };
    }
    pending.current = true;
    setBusy(true);
    setLocked(true);
    setError("");
    setNotice("");
    try {
      await codRequest(token, "/cod/handovers", snapshot.current);
      snapshot.current = null;
      setLocked(false);
      setSelected({});
      setNote("");
      setTab("history");
      setPage(0);
      setReload((v) => v + 1);
      setNotice("Handover reported. Waiting for administrator confirmation.");
      onChanged();
    } catch (failure) {
      if ([400, 401, 403, 404, 409].includes(failure.status)) {
        snapshot.current = null;
        setLocked(false);
        setSelected({});
        setReload((v) => v + 1);
        setError(failure.message);
      } else
        setError(
          "Could not confirm the result. Tap Retry confirmation to reuse the same report ID.",
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function confirm() {
    if (locked) {
      submit();
      return;
    }
    if (!choices.length) {
      setError("Select at least one collected order.");
      return;
    }
    Alert.alert(
      "Cash physically handed over?",
      `Report ${money(total)} for ${choices.length} collected order(s)? Only proceed after handing this cash to the administrator.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Report handover", onPress: submit },
      ],
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {detailId ? "Handover details" : "COD cash handovers"}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={close}
              style={styles.button}
            >
              <Text style={styles.link}>{detailId ? "Back" : "Close"}</Text>
            </Pressable>
          </View>
          {!detailId && (
            <View style={styles.tabs}>
              {[
                ["report", "Report handover"],
                ["history", "History"],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tab === value }}
                  disabled={busy || locked}
                  onPress={() => switchTab(value)}
                  style={[styles.tab, tab === value && styles.activeTab]}
                >
                  <Text style={[styles.link, tab === value && styles.white]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {detailId ? (
              !detailCurrent ? (
                <ActivityIndicator color="#7c3aed" />
              ) : detail.error ? (
                <Text style={styles.error}>{detail.error}</Text>
              ) : (
                <>
                  <Text style={styles.amount}>
                    {money(detail.data.handover.amount)}
                  </Text>
                  <Text style={styles.status}>
                    {detail.data.handover.status}
                  </Text>
                  <Text style={styles.muted}>
                    Reported{" "}
                    {new Date(detail.data.handover.createdAt).toLocaleString(
                      "en-PK",
                    )}
                  </Text>
                  {detail.data.handover.note ? (
                    <Text style={styles.muted}>
                      Your note: {detail.data.handover.note}
                    </Text>
                  ) : null}
                  {detail.data.handover.adminName ? (
                    <Text style={styles.muted}>
                      Reviewed by: {detail.data.handover.adminName}
                    </Text>
                  ) : null}
                  {detail.data.handover.decisionNote ? (
                    <Text style={styles.muted}>
                      Administrator note: {detail.data.handover.decisionNote}
                    </Text>
                  ) : null}
                  <Text style={styles.heading}>Included collections</Text>
                  {detail.data.collections.map((item) => (
                    <View key={item.id} style={styles.card}>
                      <Text style={styles.name}>{item.orderNumber}</Text>
                      <Text style={styles.value}>{money(item.amount)}</Text>
                    </View>
                  ))}
                </>
              )
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || locked || !current}
                  onPress={() => {
                    setSelected({});
                    setReload((v) => v + 1);
                  }}
                  style={[styles.button, styles.refresh]}
                >
                  <Text style={styles.link}>Refresh</Text>
                </Pressable>
                {tab === "report" && (
                  <Text style={styles.muted}>
                    Select the completed COD orders whose cash you physically
                    handed over. Each collection is reported in full. Select up
                    to 100 orders across pages. This does not transfer money.
                  </Text>
                )}
                {!current ? (
                  <ActivityIndicator color="#7c3aed" style={styles.loader} />
                ) : result.error ? (
                  <Text style={styles.error}>{result.error}</Text>
                ) : (
                  <>
                    {!data.items.length && (
                      <Text style={styles.muted}>
                        {tab === "report"
                          ? "No unreported COD collections on this page."
                          : "No handover reports yet."}
                      </Text>
                    )}
                    {data.items.map((item) =>
                      tab === "report" ? (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: Boolean(selected[item.id]),
                          }}
                          disabled={busy || locked}
                          onPress={() => toggle(item)}
                          style={[
                            styles.card,
                            selected[item.id] && styles.selected,
                          ]}
                        >
                          <Text style={styles.name}>
                            {selected[item.id] ? "✓ " : "○ "}
                            {item.orderNumber}
                          </Text>
                          <Text style={styles.value}>{money(item.amount)}</Text>
                          <Text style={styles.muted}>
                            Collected{" "}
                            {new Date(item.collectedAt).toLocaleDateString(
                              "en-PK",
                            )}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          onPress={() => setDetailId(item.id)}
                          style={styles.card}
                        >
                          <Text style={styles.value}>{money(item.amount)}</Text>
                          <Text style={styles.status}>{item.status}</Text>
                          <Text style={styles.muted}>
                            {new Date(item.createdAt).toLocaleString("en-PK")}
                          </Text>
                          <Text style={styles.link}>
                            View included orders →
                          </Text>
                        </Pressable>
                      ),
                    )}
                    {data.totalPages > 1 && (
                      <View style={styles.pagination}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={busy || locked || page === 0}
                          onPress={() => setPage((v) => v - 1)}
                          style={styles.button}
                        >
                          <Text style={styles.link}>Previous</Text>
                        </Pressable>
                        <Text style={styles.muted}>
                          {page + 1} / {data.totalPages}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          disabled={
                            busy || locked || page + 1 >= data.totalPages
                          }
                          onPress={() => setPage((v) => v + 1)}
                          style={styles.button}
                        >
                          <Text style={styles.link}>Next</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
                {tab === "report" && (
                  <View style={styles.summary}>
                    <Text style={styles.heading}>
                      {choices.length} order(s) selected
                    </Text>
                    <Text style={styles.amount}>{money(total)}</Text>
                    <TextInput
                      accessibilityLabel="Cash handover note"
                      value={note}
                      onChangeText={setNote}
                      editable={!busy && !locked}
                      multiline
                      maxLength={500}
                      placeholder="Optional handover note"
                      placeholderTextColor="#ad9bbb"
                      style={styles.input}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || (!locked && !choices.length)}
                      onPress={confirm}
                      style={[styles.primary, busy && styles.dim]}
                    >
                      <Text style={styles.white}>
                        {busy
                          ? "Reporting..."
                          : locked
                            ? "Retry confirmation"
                            : "Report cash handed over"}
                      </Text>
                    </Pressable>
                    {!locked && choices.length > 0 && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setSelected({})}
                        style={styles.button}
                      >
                        <Text style={styles.link}>Clear selection</Text>
                      </Pressable>
                    )}
                    <Text style={styles.muted}>
                      Your outstanding balance changes only when the
                      administrator confirms receipt.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  header: { padding: 20, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: "#473050" },
  button: {
    padding: 13,
    backgroundColor: "#f3ecfb",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  link: { color: "#8b55cc", fontWeight: "700", fontSize: 12 },
  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 10 },
  tab: {
    flex: 1,
    alignItems: "center",
    padding: 14,
    backgroundColor: "#f3ecfb",
    borderRadius: 13,
  },
  activeTab: { backgroundColor: "#7c3aed" },
  white: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  content: { padding: 20, paddingBottom: 40 },
  refresh: { alignSelf: "flex-end", marginBottom: 12 },
  muted: { color: "#a28eac", fontSize: 11, lineHeight: 21, marginTop: 8 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#eae1f3",
    borderRadius: 16,
    marginTop: 12,
  },
  selected: { borderColor: "#9868d8", backgroundColor: "#f5effd" },
  name: { color: "#7c6590", fontWeight: "700", fontSize: 12 },
  value: { color: "#8c52cb", fontWeight: "800", fontSize: 20, marginTop: 8 },
  status: {
    color: "#a083b7",
    fontWeight: "700",
    fontSize: 11,
    marginVertical: 10,
  },
  heading: { color: "#7e618e", fontSize: 14, fontWeight: "700", marginTop: 15 },
  amount: {
    color: "#7c3aed",
    fontSize: 29,
    fontWeight: "800",
    marginVertical: 12,
  },
  summary: {
    backgroundColor: "#faf6ff",
    padding: 17,
    borderRadius: 18,
    marginTop: 20,
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#e7daf1",
    borderRadius: 12,
    padding: 12,
    color: "#725781",
    backgroundColor: "#fff",
    marginTop: 10,
    textAlignVertical: "top",
  },
  primary: {
    padding: 16,
    backgroundColor: "#7c3aed",
    borderRadius: 13,
    marginVertical: 15,
  },
  dim: { opacity: 0.5 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  notice: { color: "#398d5e", lineHeight: 21, marginBottom: 12, fontSize: 12 },
  error: { color: "#be123c", lineHeight: 21, marginBottom: 12, fontSize: 12 },
  loader: { marginVertical: 25 },
});
