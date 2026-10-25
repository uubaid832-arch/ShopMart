import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import Svg, { Path } from "react-native-svg";
import { readable } from "./adminApi";

const icons = {
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  ticket: "M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Zm12 0v2m0 3v2m0 3v2",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9M7.5 5.5l9 5",
  grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7",
  users:
    "M16 21v-2a6 6 0 0 0-12 0v2M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m3 5a5 5 0 0 1 4 5v4M17 3a4 4 0 0 1 0 8",
  truck:
    "M2 5h12v12H2V5Zm12 4h4l4 5v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  return: "M9 10 4 5l5-4M4 5h9a8 8 0 0 1 0 16H6",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6",
  wallet: "M3 5h16v15H3V5Zm0 0 13-3v3m-1 5h6v6h-6v-6m3 3h.01",
  image: "M3 3h18v18H3V3Zm0 12 5-5 6 7 3-3 4 4M17 7h.01",
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  back: "m15 5-7 7 7 7",
  arrow: "m9 5 7 7-7 7",
  down: "m5 9 7 7 7-7",
  check: "m5 12 4 4L19 6",
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
};
export function Icon({ name, size = 21, color = "#7c3aed" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={icons[name] || icons.box}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function Button({
  title,
  icon,
  onPress,
  disabled,
  danger = false,
  secondary = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        secondary && ui.secondary,
        danger && ui.danger,
        (disabled || pressed) && ui.dim,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={danger ? "#be3153" : secondary ? "#7c3aed" : "#fff"}
        />
      )}
      <Text
        style={[ui.buttonText, secondary && ui.link, danger && ui.dangerText]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Badge({ value }) {
  const bad = ["CANCELLED", "REJECTED", "DISABLED", "OUT OF STOCK"].includes(
    String(value).toUpperCase(),
  );
  const good = [
    "CONFIRMED",
    "DELIVERED",
    "REFUNDED",
    "RECEIVED",
    "ENABLED",
    "VISIBLE",
  ].includes(String(value).toUpperCase());
  return (
    <View style={[ui.badge, bad && ui.danger, good && ui.good]}>
      <Text style={[ui.badgeText, bad && ui.dangerText, good && ui.goodText]}>
        {readable(value)}
      </Text>
    </View>
  );
}
export function Card({ title, subtitle, children }) {
  return (
    <View style={ui.card}>
      {title && <Text style={ui.title}>{title}</Text>}
      {subtitle && <Text style={ui.muted}>{subtitle}</Text>}
      {children}
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  ...props
}) {
  return (
    <View style={ui.field}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor="#9b8eac"
        style={[ui.input, multiline && ui.multiline]}
        {...props}
      />
    </View>
  );
}
export function Choice({ label, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={ui.field}>
      <Text style={ui.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || "Choose an option"}`}
        accessibilityState={{ expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={ui.select}
      >
        <Text style={[ui.body, ui.grow]}>
          {selected?.label || "Choose an option"}
        </Text>
        <Icon name="down" size={16} />
      </Pressable>
      {open && (
        <View style={ui.options}>
          {options.length ? (
            options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: option.value === value }}
                disabled={disabled}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[ui.option, option.value === value && ui.chosen]}
              >
                <Text style={[ui.body, ui.grow]}>{option.label}</Text>
                {option.value === value && <Icon name="check" size={17} />}
              </Pressable>
            ))
          ) : (
            <Text style={ui.muted}>No options available.</Text>
          )}
        </View>
      )}
    </View>
  );
}
export function Notice({ op }) {
  return (
    <>
      {op.busy && (
        <View style={ui.row}>
          <ActivityIndicator color="#7c3aed" />
          <Text style={ui.muted}>Working...</Text>
        </View>
      )}
      {op.error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {op.error}
        </Text>
      ) : null}
      {op.notice ? <Text style={ui.success}>{op.notice}</Text> : null}
      {op.uncertain && (
        <Text style={ui.error}>
          The result is uncertain. Close this editor, refresh the list and check
          the current record before trying again.
        </Text>
      )}
    </>
  );
}
export function Page({
  title,
  onClose,
  busy = false,
  onRefresh,
  onBack,
  children,
  toolbar,
  primaryAction,
  footerAction,
}) {
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!busy) (onBack || onClose)();
      }}
    >
      <SafeAreaView style={ui.screen}>
        <View style={ui.header}>
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={busy}
              style={ui.iconButton}
              onPress={onBack}
            >
              <Icon name="back" />
            </Pressable>
          )}
          <View style={ui.grow}>
            <Text style={ui.eyebrow}>SHOPMART ADMIN</Text>
            <Text style={ui.heading}>{title}</Text>
          </View>
          {onRefresh && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh"
              disabled={busy}
              onPress={onRefresh}
              style={ui.iconButton}
            >
              <Icon name="refresh" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close module"
            disabled={busy}
            onPress={onClose}
            style={ui.iconButton}
          >
            <Icon name="close" />
          </Pressable>
        </View>
        {toolbar}
        {children}
        {footerAction ? (
          <View style={ui.actionDock}>{footerAction}</View>
        ) : null}
        {primaryAction && (
          <View style={ui.actionDock}>
            <Button {...primaryAction} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
export function Form({ children }) {
  return (
    <KeyboardAvoidingView
      style={ui.grow}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.content}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function PagedList({
  result,
  page,
  onPage,
  renderItem,
  search = "",
  onSearch,
  filter,
  toolbar,
}) {
  const data = result.data;
  const items = Array.isArray(data) ? data : data?.items || [];
  const query = search.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      (!filter || filter(item)) &&
      (!query || JSON.stringify(item).toLowerCase().includes(query)),
  );
  return (
    <>
      {onSearch && (
        <View style={ui.searchBox}>
          <Icon name="search" size={18} />
          <TextInput
            accessibilityLabel="Search current page"
            placeholder="Search this page"
            placeholderTextColor="#9b8eac"
            value={search}
            onChangeText={onSearch}
            style={ui.searchInput}
          />
        </View>
      )}
      {toolbar}
      <Text style={ui.listCaption}>
        {Array.isArray(data)
          ? `${items.length} records`
          : `${data?.totalItems ?? 0} records in total`}
        {onSearch ? " · Search applies to this page" : ""}
      </Text>
      {result.loading ? (
        <ActivityIndicator size="large" color="#7c3aed" style={ui.loader} />
      ) : result.error ? (
        <Text accessibilityRole="alert" style={[ui.error, ui.content]}>
          {result.error}
        </Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id || item.orderId)}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={ui.content}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={ui.empty}>
              <Icon name="box" size={40} />
              <Text style={ui.title}>No records to show</Text>
              <Text style={ui.muted}>Try another page or filter.</Text>
            </View>
          }
        />
      )}
      <View style={ui.pagination}>
        <Button
          title="Previous"
          icon="back"
          secondary
          disabled={result.loading || page === 0}
          onPress={() => onPage(page - 1)}
        />
        <Text style={ui.muted}>
          Page {page + 1} / {Math.max(1, data?.totalPages || 1)}
        </Text>
        <Button
          title="Next"
          icon="arrow"
          secondary
          disabled={
            result.loading ||
            !data ||
            Array.isArray(data) ||
            page + 1 >= data.totalPages
          }
          onPress={() => onPage(page + 1)}
        />
      </View>
    </>
  );
}
export function confirm(title, message, action, danger = false) {
  Alert.alert(title, message, [
    { text: "Go back", style: "cancel" },
    {
      text: "Confirm",
      style: danger ? "destructive" : "default",
      onPress: action,
    },
  ]);
}
export function check(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
}
export function useMutation(onChanged) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(action, message = "Saved.", after) {
    if (pending.current || uncertain) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await action();
      if (mounted.current) {
        if (!value?.cancelled) {
          setNotice(message);
          changed.current?.();
          after?.(value);
        }
      }
      return true;
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message || "Could not confirm the result.");
        if (!failure.status || failure.status >= 500) setUncertain(true);
        changed.current?.();
      }
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    busy,
    error,
    notice,
    uncertain,
    run,
    blocked: busy || uncertain,
    reset() {
      if (!pending.current) {
        setError("");
        setNotice("");
        setUncertain(false);
      }
    },
  };
}
export const ui = StyleSheet.create({
  actionDock: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eae3f2",
  },
  screen: { flex: 1, backgroundColor: "#faf9fd" },
  grow: { flex: 1, minWidth: 0 },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  eyebrow: {
    color: "#9a80b4",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heading: { color: "#352442", fontSize: 23, fontWeight: "800", marginTop: 5 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#eee7f8",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eae3f2",
    borderRadius: 20,
    padding: 17,
    marginBottom: 14,
  },
  title: { color: "#493451", fontWeight: "800", fontSize: 16, marginBottom: 5 },
  body: { color: "#725e83", fontSize: 12, lineHeight: 21 },
  muted: { color: "#8a789b", fontSize: 10, lineHeight: 18, marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  button: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 46,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 11,
  },
  buttonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  secondary: { backgroundColor: "#f0eafa" },
  link: { color: "#7c3aed", fontSize: 11, fontWeight: "700" },
  danger: { backgroundColor: "#fff0f3" },
  dangerText: { color: "#ba3658" },
  good: { backgroundColor: "#e9f6ee" },
  goodText: { color: "#257c50" },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: "#f0eafa",
    marginTop: 8,
  },
  badgeText: { fontSize: 9, fontWeight: "700", color: "#7c3aed" },
  error: { color: "#be3153", fontSize: 12, lineHeight: 21, marginVertical: 10 },
  success: {
    color: "#257c50",
    fontSize: 12,
    lineHeight: 21,
    marginVertical: 10,
  },
  field: { marginTop: 16 },
  label: { color: "#624970", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e3d9ee",
    borderRadius: 13,
    padding: 13,
    minHeight: 48,
    backgroundColor: "#fff",
    color: "#493451",
    fontSize: 13,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
  select: {
    borderWidth: 1,
    borderColor: "#e3d9ee",
    borderRadius: 13,
    padding: 13,
    minHeight: 48,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  options: {
    borderWidth: 1,
    borderColor: "#e3d9ee",
    borderRadius: 13,
    overflow: "hidden",
    marginTop: 7,
  },
  option: {
    padding: 13,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee7f5",
  },
  chosen: { backgroundColor: "#eee4fc" },
  pagination: {
    padding: 13,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eae3f2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchBox: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "#e3d9ee",
    borderRadius: 14,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 13,
  },
  searchInput: {
    flex: 1,
    padding: 13,
    fontSize: 13,
    color: "#493451",
    minHeight: 48,
  },
  listCaption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 10,
    color: "#8a789b",
  },
  loader: { marginTop: 40 },
  empty: { paddingVertical: 45, alignItems: "center", gap: 13 },
  dim: { opacity: 0.45 },
  amount: {
    fontSize: 22,
    color: "#7c3aed",
    fontWeight: "800",
    marginVertical: 10,
  },
  info: {
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#f0eafa",
    marginVertical: 12,
  },
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 15,
    backgroundColor: "#f4f0fa",
  },
  toolbar: { paddingHorizontal: 20, paddingBottom: 14 },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee7f5",
    paddingVertical: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
});
