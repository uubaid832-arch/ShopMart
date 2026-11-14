import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useMobileAppearance } from "../appearance/MobileAppearance";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

const label = (value) => String(value === "APPROVED" ? "Accepted after inspection" : value === "RECEIVED" ? "Received - awaiting inspection" : value || "Not initiated").replace(/_/g, " ");

async function request(token, path, values, signal) {
  const response = await fetch(`${baseUrl}/api/mobile/returns${path}`, {
    method: values ? "POST" : "GET",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(values && { "Content-Type": "application/json" }),
    },
    body: values ? JSON.stringify(values) : undefined,
    signal,
  });

  if (!response.ok) {
    const messages = {
      400: "Select a purchased item and enter a reason of up to 1,000 characters.",
      401: "Your session expired. Please sign in again.",
      403: "Access denied.",
      404: "Purchased item not found.",
      409: "This item is no longer eligible or already has a return request.",
    };

    throw new Error(
      messages[response.status] ||
        "Could not confirm the request. Refresh before trying again.",
    );
  }

  return response.json();
}

export default function ReturnsModal({ session, onClose, orderId = null }) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const token = session.accessToken;
  const [tab, setTab] = useState("eligible");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reasonType, setReasonType] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const path = tab === "eligible"
      ? `/eligible?page=${page}&size=10${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ""}`
      : `?page=${page}&size=10`;

    request(token, path, undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ token, tab, page, reload, data, error: "" });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            tab,
            page,
            reload,
            data: null,
            error: failure.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, tab, page, reload, orderId]);

  const current =
    result?.token === token &&
    result?.tab === tab &&
    result?.page === page &&
    result?.reload === reload;

  const data = current ? result.data : null;

  function close() {
    if (!pending.current) onClose();
  }

  function changeTab(next) {
    if (pending.current) return;
    setTab(next);
    setPage(0);
    setSelected(null);
    setReasonType("");
    setReasonDetails("");
    setError("");
  }

  async function submit() {
    if (pending.current || !current) return;

    const item = data?.items.find((entry) => entry.orderItemId === selected);

    if (!item || !reasonType || (reasonType === "Other" && !reasonDetails.trim())) {
      setError("Choose a product and reason. If you choose Other, describe the issue.");
      return;
    }

    const reason = reasonType === "Other"
      ? `Other: ${reasonDetails.trim()}`
      : reasonType;

    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await request(token, "", {
        orderId: item.orderId,
        orderItemId: item.orderItemId,
        reason,
      });

      setSelected(null);
      setReasonType("");
      setReasonDetails("");
      setTab("history");
      setPage(0);
      setReload((value) => value + 1);
      setNotice("Your return request has been submitted.");
    } catch (failure) {
      setError(failure.message);
      setSelected(null);
      setReload((value) => value + 1);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.header, { backgroundColor: palette.surface, borderBottomColor: palette.border }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>SHOPMART AFTER-SALES</Text>
              <Text style={[styles.title, { color: palette.text }]}>Returns & refunds</Text>
              <Text style={[styles.headerSubtitle, { color: palette.muted }]}>Request a return and follow every update.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={close}
              style={[styles.closeButton, { backgroundColor: palette.soft }]}
            >
              <Text style={[styles.closeText, { color: palette.text }]}>×</Text>
            </Pressable>
          </View>

          <View style={[styles.tabs, { backgroundColor: palette.soft }]}>
            {[
              ["eligible", "Start a return"],
              ["history", "My requests"],
            ].map(([value, title]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === value }}
                disabled={busy}
                onPress={() => changeTab(value)}
                style={[styles.tab, tab === value && { backgroundColor: palette.surface, borderColor: palette.border }]}
              >
                <Text style={[styles.tabText, { color: tab === value ? palette.accent : palette.muted }]}>
                  {title}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              accessibilityRole="button"
              disabled={busy || !current}
              onPress={() => {
                setSelected(null);
                setReload((value) => value + 1);
              }}
              style={[styles.refresh, { backgroundColor: palette.accentSoft }]}
            >
              <Text style={[styles.link, { color: palette.accent }]}>↻  Refresh</Text>
            </Pressable>

            {notice ? <Text style={[styles.notice, { color: palette.success, backgroundColor: palette.accentSoft }]}>{notice}</Text> : null}
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger, backgroundColor: theme.isDark ? "#3b202b" : "#fff1f2" }]}>
                {error}
              </Text>
            ) : null}

            {!current ? (
              <ActivityIndicator color={palette.accent} />
            ) : result.error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: palette.danger, backgroundColor: theme.isDark ? "#3b202b" : "#fff1f2" }]}>
                {result.error}
              </Text>
            ) : (
              <>
                {tab === "history" && (
                  <View style={[styles.historyIntro, { backgroundColor: theme.isDark ? palette.elevated : palette.accentSoft, borderColor: palette.border }]}>
                    <Text style={[styles.historyIntroEyebrow, { color: palette.accent }]}>YOUR RETURN PROGRESS</Text>
                    <Text style={[styles.historyIntroTitle, { color: palette.text }]}>Keep track of every update</Text>
                    <Text style={[styles.description, { color: palette.muted }]}>See return decisions, item checks, and refund status in one place.</Text>
                  </View>
                )}
                {tab === "eligible" && (
                  <View style={[styles.hero, { backgroundColor: theme.isDark ? palette.elevated : palette.accentSoft, borderColor: palette.border }]}>
                    <View style={[styles.heroIcon, { backgroundColor: palette.surface }]}><Text style={[styles.heroIconText, { color: palette.accent }]}>↩</Text></View>
                    <Text style={[styles.heroTitle, { color: palette.text }]}>Need to return an item?</Text>
                    <Text style={[styles.description, { color: palette.muted }]}>Choose an eligible delivered item, select a reason, and we’ll keep you updated here.</Text>
                    <View style={styles.steps}>
                      {[["1", "Choose item"], ["2", "Tell us why"], ["3", "Track progress"]].map(([number, title]) => <View key={number} style={styles.step}><Text style={[styles.stepNumber, { color: palette.accent, backgroundColor: palette.surface }]}>{number}</Text><Text style={[styles.stepText, { color: palette.muted }]}>{title}</Text></View>)}
                    </View>
                  </View>
                )}

                {data.items.length === 0 && (
                  <View style={[styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <Text style={[styles.emptyIcon, { color: palette.accent }]}>✓</Text>
                    <Text style={[styles.emptyTitle, { color: palette.text }]}>{tab === "eligible" ? "No items to return right now" : "No return requests yet"}</Text>
                    <Text style={[styles.description, { color: palette.muted }]}>
                    {tab === "eligible"
                      ? orderId ? "This order needs to be delivered and paid, and it must not already have a return request." : "Only eligible delivered orders appear here. Check back after your order arrives."
                      : "When you submit a return request, its decision and refund progress will appear here."}
                    </Text>
                    <Pressable accessibilityRole="button" onPress={() => changeTab(tab === "eligible" ? "history" : "eligible")} style={[styles.emptyAction, { backgroundColor: palette.accent }]}>
                      <Text style={styles.white}>{tab === "eligible" ? "View my requests" : "Start a return"}</Text>
                    </Pressable>
                  </View>
                )}

                {data.items.map((item) =>
                  tab === "eligible" ? (
                    <Pressable
                      key={item.orderItemId}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: selected === item.orderItemId,
                      }}
                      disabled={busy}
                      onPress={() => {
                        setSelected(item.orderItemId);
                        setReasonType("");
                        setReasonDetails("");
                        setError("");
                      }}
                      style={[styles.card, { backgroundColor: palette.surface, borderColor: selected === item.orderItemId ? palette.accent : palette.border }, selected === item.orderItemId && { backgroundColor: palette.accentSoft }]}
                    >
                      <View style={styles.itemHeader}>
                        <View style={[styles.itemIcon, { backgroundColor: palette.accentSoft }]}><Text style={[styles.itemIconText, { color: palette.accent }]}>□</Text></View>
                        <View style={styles.itemCopy}>
                          <Text style={[styles.name, { color: palette.text }]}>{item.productName}</Text>
                          <Text style={[styles.muted, { color: palette.muted }]}>{item.orderNumber} · Quantity {item.quantity}</Text>
                        </View>
                        <View style={[styles.selectMark, { borderColor: selected === item.orderItemId ? palette.accent : palette.border, backgroundColor: selected === item.orderItemId ? palette.accent : palette.surface }]}>
                          {selected === item.orderItemId && <Text style={styles.check}>✓</Text>}
                        </View>
                      </View>
                      <Text style={[styles.cardAction, { color: palette.accent }]}>{selected === item.orderItemId ? "Item selected — choose a reason below" : "Tap to choose this item"}</Text>
                    </Pressable>
                  ) : (
                    <View key={item.id} style={[styles.historyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                      <View style={styles.historyHeader}>
                        <View style={styles.itemCopy}>
                          <Text style={[styles.historyEyebrow, { color: palette.muted }]}>RETURN REQUEST</Text>
                          <Text style={[styles.name, { color: palette.text }]}>{item.productName}</Text>
                        </View>
                        <Text style={[styles.statusBadge, item.status === "REJECTED"
                          ? { color: palette.danger, backgroundColor: theme.isDark ? "#3b202b" : "#fff1f2" }
                          : { color: palette.accent, backgroundColor: palette.accentSoft }]}>{label(item.status)}</Text>
                      </View>
                      <Text style={[styles.muted, { color: palette.muted }]}>{item.orderNumber} · {new Date(item.createdAt).toLocaleDateString("en-PK")}</Text>
                      <View style={[styles.historyReason, { backgroundColor: palette.soft }]}>
                        <Text style={[styles.historyLabel, { color: palette.muted }]}>REASON</Text>
                        <Text style={[styles.description, { color: palette.text }]}>{item.reason}</Text>
                      </View>
                      <View style={[styles.refundRow, { borderTopColor: palette.border }]}>
                        <View>
                          <Text style={[styles.historyLabel, { color: palette.muted }]}>REFUND STATUS</Text>
                          <Text style={[styles.refundStatus, { color: item.refundStatus === "REFUNDED" ? palette.success : palette.text }]}>{label(item.refundStatus)}</Text>
                        </View>
                        {item.refundAmount != null && <View style={styles.amountBlock}>
                          <Text style={[styles.historyLabel, { color: palette.muted }]}>AMOUNT</Text>
                          <Text style={[styles.refundAmount, { color: palette.accent }]}>PKR {Number(item.refundAmount).toLocaleString("en-PK")}</Text>
                        </View>}
                      </View>
                      {item.rejectionReason ? (
                        <Text style={[styles.rejection, { color: palette.danger, backgroundColor: theme.isDark ? "#3b202b" : "#fff1f2" }]}>
                          Return not approved: {item.rejectionReason}. Your product will be shipped back soon.
                        </Text>
                      ) : null}
                      {/* Existing status and refund state stay visible together for clarity. */}
                      <Text style={[styles.muted, { color: palette.muted }]}>
                        Quantity: {item.quantity}
                      </Text>
                    </View>
                  ),
                )}

                {tab === "eligible" && selected && (
                  <View style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <Text style={[styles.formEyebrow, { color: palette.accent }]}>STEP 2 OF 2</Text>
                    <Text style={[styles.formTitle, { color: palette.text }]}>Why are you returning it?</Text>
                    <Text style={[styles.formHint, { color: palette.muted }]}>Choose the closest reason. It helps us handle your request faster.</Text>
                    {[
                      "Wrong item received",
                      "Item is damaged",
                      "Item is defective or not working",
                      "Missing parts or accessories",
                      "Item does not match description",
                      "Size or fit issue",
                      "Changed my mind",
                      "Other",
                    ].map((option) => (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: reasonType === option }}
                        disabled={busy}
                        onPress={() => {
                          setReasonType(option);
                          setReasonDetails("");
                          setError("");
                        }}
                        style={[
                          styles.reasonOption,
                          { backgroundColor: reasonType === option ? palette.accentSoft : palette.surface, borderColor: reasonType === option ? palette.accent : palette.border },
                        ]}
                      >
                        <View style={[
                          styles.radioMark,
                          { borderColor: reasonType === option ? palette.accent : palette.muted, backgroundColor: reasonType === option ? palette.accent : "transparent" },
                        ]} />
                        <Text style={[styles.reasonOptionText, { color: palette.text }]}>{option}</Text>
                      </Pressable>
                    ))}
                    {reasonType === "Other" && (
                      <>
                        <Text style={[styles.fieldLabel, { color: palette.text }]}>Describe the specific issue (required)</Text>
                        <TextInput
                          accessibilityLabel="Describe the specific issue"
                          placeholder="Tell us what is wrong with the item"
                          placeholderTextColor={palette.muted}
                          value={reasonDetails}
                          onChangeText={setReasonDetails}
                          editable={!busy}
                          maxLength={980}
                          multiline
                          textAlignVertical="top"
                          style={[styles.input, { color: palette.text, backgroundColor: palette.soft, borderColor: palette.border }]}
                        />
                        <Text style={[styles.muted, { color: palette.muted }]}>{reasonDetails.length}/980</Text>
                      </>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={submit}
                      style={[styles.submit, { backgroundColor: palette.accent }]}
                    >
                      <Text style={styles.white}>
                        {busy ? "Submitting..." : "Submit return request"}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {data.totalPages > 1 && (
                  <View style={styles.pagination}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || page === 0}
                      onPress={() => {
                        setSelected(null);
                        setPage((value) => value - 1);
                      }}
                      style={[styles.button, { backgroundColor: palette.soft }]}
                    >
                      <Text style={[styles.link, { color: palette.accent }]}>Previous</Text>
                    </Pressable>
                    <Text style={[styles.muted, { color: palette.muted }]}>
                      {page + 1} / {data.totalPages}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy || page + 1 >= data.totalPages}
                      onPress={() => {
                        setSelected(null);
                        setPage((value) => value + 1);
                      }}
                      style={[styles.button, { backgroundColor: palette.soft }]}
                    >
                      <Text style={[styles.link, { color: palette.accent }]}>Next</Text>
                    </Pressable>
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
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 17,
    gap: 12,
    borderBottomWidth: 1,
  },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 9, letterSpacing: 1.4, fontWeight: "900" },
  title: { fontSize: 24, fontWeight: "900", flex: 1, marginTop: 5, letterSpacing: -0.6 },
  headerSubtitle: { fontSize: 12, marginTop: 4 },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  closeText: { fontSize: 27, lineHeight: 30 },
  button: { padding: 12, borderRadius: 12 },
  link: { color: "#7c3aed", fontWeight: "700", fontSize: 12 },
  tabs: { flexDirection: "row", marginHorizontal: 18, marginTop: 14, padding: 5, borderRadius: 16, gap: 5 },
  tab: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
  tabText: { fontSize: 12, fontWeight: "800", textAlign: "center" },
  white: { color: "#fff", fontWeight: "700", textAlign: "center" },
  content: { padding: 18, paddingTop: 14, paddingBottom: 44 },
  refresh: { alignSelf: "flex-end", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, marginBottom: 10 },
  hero: { padding: 18, borderRadius: 22, borderWidth: 1, marginBottom: 17 },
  heroIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  heroIconText: { fontSize: 27, fontWeight: "800" },
  heroTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  description: { lineHeight: 20, marginTop: 8, marginBottom: 3, fontSize: 13 },
  steps: { flexDirection: "row", gap: 7, marginTop: 15 },
  step: { flex: 1, alignItems: "center", gap: 6 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, textAlign: "center", textAlignVertical: "center", fontSize: 12, fontWeight: "900", overflow: "hidden" },
  stepText: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 23, alignItems: "center", marginVertical: 8 },
  emptyIcon: { fontSize: 32, fontWeight: "900", marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyAction: { marginTop: 15, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  historyIntro: { padding: 17, borderRadius: 20, borderWidth: 1, marginBottom: 15 },
  historyIntroEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  historyIntroTitle: { fontSize: 19, fontWeight: "900", marginTop: 5 },
  card: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 10,
  },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemIconText: { fontSize: 22, fontWeight: "700" },
  itemCopy: { flex: 1, minWidth: 0 },
  cardAction: { marginTop: 12, fontSize: 11, fontWeight: "800" },
  selectMark: { width: 24, height: 24, borderWidth: 2, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  check: { color: "#fff", fontSize: 13, fontWeight: "900" },
  name: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  muted: { fontSize: 11, marginTop: 5 },
  historyCard: { borderWidth: 1, borderRadius: 19, padding: 15, marginBottom: 11 },
  historyHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  historyEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.1, marginBottom: 5 },
  statusBadge: { fontSize: 10, fontWeight: "800", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, overflow: "hidden", textAlign: "center", maxWidth: 132 },
  historyReason: { marginTop: 13, padding: 12, borderRadius: 13 },
  historyLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  refundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, marginTop: 13, paddingTop: 12 },
  amountBlock: { alignItems: "flex-end" },
  refundStatus: { marginTop: 4, fontSize: 13, fontWeight: "800" },
  refundAmount: { marginTop: 4, fontSize: 14, fontWeight: "900" },
  rejection: { padding: 11, borderRadius: 12, lineHeight: 18, fontSize: 11, marginTop: 12 },
  form: { marginTop: 15, marginBottom: 18, padding: 16, borderRadius: 20, borderWidth: 1 },
  formEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  formTitle: { fontSize: 18, fontWeight: "900", marginTop: 5 },
  formHint: { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "800", marginTop: 10 },
  reasonOption: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reasonOptionSelected: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
  radioMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#94a3b8",
  },
  radioMarkSelected: { borderColor: "#7c3aed", backgroundColor: "#7c3aed" },
  reasonOptionText: { color: "#334155", fontSize: 14, flex: 1 },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    color: "#334155",
    fontSize: 14,
  },
  submit: {
    backgroundColor: "#7c3aed",
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  notice: { lineHeight: 20, marginBottom: 14, padding: 12, borderRadius: 13, fontSize: 12, fontWeight: "700" },
  error: { lineHeight: 20, marginBottom: 14, padding: 12, borderRadius: 13, fontSize: 12, fontWeight: "700" },
});
