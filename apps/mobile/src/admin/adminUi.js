import { cloneElement, useEffect, useRef, useState } from "react";
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
import { useMobileAppearance } from "../appearance/MobileAppearance";
import AppearanceModal from "../appearance/AppearanceModal";

let activePalette = null;
export function setAdminPalette(palette) {
  activePalette = palette;
}

const icons = {
  mail: "M3 5h18v14H3V5Zm0 0 9 7 9-7",
  chat: "M21 11a9 9 0 0 1-9 9H4l-3 3V11a10 10 0 0 1 20 0Z",
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
  palette: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a1.5 1.5 0 0 1 0-3h3a6 6 0 0 0 6-6c0-2.8-4-5-9-5ZM7.5 10h.01M10 6.5h.01M15 6.5h.01M17.5 10h.01",
};
export function Icon({ name, size = 21, color }) {
  const { theme } = useMobileAppearance();
  setAdminPalette(theme.colors);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={icons[name] || icons.box}
        stroke={color || theme.colors.accent}
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
  compact = false,
}) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  setAdminPalette(palette);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        { backgroundColor: danger ? (theme.isDark ? "#442330" : "#fff0f3") : secondary ? palette.accentSoft : palette.accent },
        compact && ui.compactButton,
        (disabled || pressed) && ui.dim,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={danger ? palette.danger : secondary ? palette.accent : "#fff"}
        />
      )}
      <Text
        style={[ui.buttonText, secondary && { color: palette.accent }, danger && { color: palette.danger }]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Badge({ value }) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  setAdminPalette(palette);
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
    <View style={[ui.badge, { backgroundColor: bad ? (theme.isDark ? "#442330" : "#fff0f3") : good ? (theme.isDark ? "#173a2c" : "#e9f6ee") : palette.accentSoft }]}>
      <Text style={[ui.badgeText, { color: bad ? palette.danger : good ? palette.success : palette.accent }]}>
        {readable(value)}
      </Text>
    </View>
  );
}
export function Card({ title, subtitle, children }) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  setAdminPalette(palette);
  return (
    <View style={[ui.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {title && <Text style={[ui.title, { color: palette.text }]}>{title}</Text>}
      {subtitle && <Text style={[ui.muted, { color: palette.muted }]}>{subtitle}</Text>}
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
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  setAdminPalette(palette);
  return (
    <View style={ui.field}>
      <Text style={[ui.label, { color: palette.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={palette.muted}
        selectionColor={palette.accent}
        style={[ui.input, { backgroundColor: palette.elevated, borderColor: palette.border, color: palette.text }, multiline && ui.multiline]}
        {...props}
      />
    </View>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
  disabled,
  compact = false,
}) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  setAdminPalette(palette);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={compact ? ui.compactFilter : ui.field}>
      {!compact && <Text style={[ui.label, { color: palette.text }]}>{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || "Choose an option"}`}
        accessibilityState={{ expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[ui.select, { backgroundColor: palette.surface, borderColor: palette.border }, compact && { minHeight: 44, paddingVertical: 10 }]}
      >
        {compact && (
          <Icon
            name={
              label.includes("role")
                ? "users"
                : label.includes("Voucher")
                  ? "ticket"
                  : "box"
            }
            size={18}
          />
        )}
        <Text style={[ui.body, ui.grow, { color: palette.text }]}>
          {selected?.label || "Choose an option"}
        </Text>
        <Icon name="down" size={16} />
      </Pressable>
      {open && (
        <View style={[ui.options, { backgroundColor: palette.surface, borderColor: palette.border }]}>
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
                style={[ui.option, { backgroundColor: palette.surface, borderBottomColor: palette.border }, option.value === value && { backgroundColor: palette.accentSoft }]}
              >
                <Text style={[ui.body, ui.grow, { color: palette.text }]}>{option.label}</Text>
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
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  setAdminPalette(palette);
  return (
    <>
      {op.busy && (
        <View style={ui.row}>
          <ActivityIndicator color={palette.accent} />
          <Text style={[ui.muted, { color: palette.muted }]}>Working...</Text>
        </View>
      )}
      {op.error ? (
        <Text accessibilityRole="alert" style={[ui.error, { color: palette.danger }]}>
          {op.error}
        </Text>
      ) : null}
      {op.notice ? <Text style={[ui.success, { color: palette.success }]}>{op.notice}</Text> : null}
      {op.uncertain && (
        <Text style={[ui.error, { color: palette.danger }]}>
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
  const { theme } = useMobileAppearance();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  setAdminPalette(theme.colors);
  const palette = theme.colors;
  return (
    <>
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!busy) (onBack || onClose)();
      }}
    >
      <SafeAreaView style={[ui.screen, { backgroundColor: palette.background }]}>
        <View style={ui.topActions}>
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={busy}
              style={[ui.iconButton, { backgroundColor: palette.soft, marginRight: "auto" }]}
              onPress={onBack}
            >
              <Icon name="back" />
            </Pressable>
          )}
          {onRefresh && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh"
              disabled={busy}
              style={[ui.iconButton, { backgroundColor: palette.soft }]}
              onPress={onRefresh}
            >
              <Icon name="refresh" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change app theme"
            style={[ui.iconButton, { backgroundColor: palette.soft }]}
            onPress={() => setAppearanceOpen(true)}
          >
            <Icon name="palette" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close module"
            disabled={busy}
            style={[ui.iconButton, { backgroundColor: palette.soft }]}
            onPress={onClose}
          >
            <Icon name="close" />
          </Pressable>
        </View>
        <View style={ui.header}>
          <View style={ui.grow}>
            <Text style={[ui.eyebrow, { color: palette.accent }]}>SHOPMART ADMIN</Text>
            <Text style={[ui.heading, { color: palette.text }]}>{title}</Text>
          </View>
          {footerAction ? (
            cloneElement(footerAction, {
              compact: true,
              title: footerAction.props.title.includes("voucher")
                ? "Generate"
                : "Add",
            })
          ) : primaryAction ? (
            <Button {...primaryAction} compact title="Add" />
          ) : null}
        </View>
        {toolbar}
        {children}
      </SafeAreaView>
    </Modal>
    <AppearanceModal
      visible={appearanceOpen}
      onClose={() => setAppearanceOpen(false)}
    />
    </>
  );
}
export function Form({ children }) {
  const { theme } = useMobileAppearance();
  return (
    <KeyboardAvoidingView
      style={[ui.grow, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[ui.content, { backgroundColor: theme.colors.background }]}
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
  serverSearch = false,
}) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  setAdminPalette(palette);
  const data = result.data;
  const items = Array.isArray(data) ? data : data?.items || [];
  const query = search.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      (!filter || filter(item)) &&
      (serverSearch ||
        !query ||
        JSON.stringify(item).toLowerCase().includes(query)),
  );
  return (
    <>
      {onSearch && (
        <View style={[ui.searchBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Icon name="search" size={18} />
          <TextInput
            accessibilityLabel={
              serverSearch ? "Search all records" : "Search current page"
            }
            placeholder={
              serverSearch ? "Search name or email" : "Search this page"
            }
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={onSearch}
            style={[ui.searchInput, { color: palette.text }]}
          />
        </View>
      )}
      {toolbar}
      <Text style={[ui.listCaption, { color: palette.muted }]}>
        {Array.isArray(data)
          ? `${items.length} records`
          : `${data?.totalItems ?? 0} records in total`}
        {onSearch && !serverSearch ? " · Search applies to this page" : ""}
      </Text>
      {result.loading ? (
        <ActivityIndicator size="large" color={palette.accent} style={ui.loader} />
      ) : result.error ? (
        <Text accessibilityRole="alert" style={[ui.error, { color: palette.danger }, ui.content]}>
          {result.error}
        </Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id || item.orderId)}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={[ui.content, { backgroundColor: palette.background }]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={ui.empty}>
              <Icon name="box" size={40} />
              <Text style={[ui.title, { color: palette.text }]}>No records to show</Text>
              <Text style={[ui.muted, { color: palette.muted }]}>Try another page or filter.</Text>
            </View>
          }
        />
      )}
      <View style={[ui.pagination, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
        <Button
          title="Previous"
          icon="back"
          secondary
          disabled={result.loading || page === 0}
          onPress={() => onPage(page - 1)}
        />
        <Text style={[ui.muted, { color: palette.muted }]}>
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
const baseUi = StyleSheet.create({
  topActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 18,
    paddingTop: 9,
  },
  compactButton: {
    minHeight: 42,
    marginTop: 0,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  compactFilter: { flex: 1, minWidth: 140, marginTop: 0 },
  actionDock: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eae3f2",
  },
  screen: { flex: 1, backgroundColor: "#faf8ff" },
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
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heading: { color: "#352442", fontSize: 27, fontWeight: "900", marginTop: 5 },
  iconButton: {
    width: 38,
    height: 38,
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
    borderRadius: 15,
    padding: 15,
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
  secondary: { backgroundColor: "#f6f1fd", paddingVertical: 10, minHeight: 42 },
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
    backgroundColor: "#faf8ff",
    borderTopWidth: 0,
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
  toolbar: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
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

const themedUi = {
  screen: (c) => ({ backgroundColor: c.background }),
  actionDock: (c) => ({ backgroundColor: c.surface, borderTopColor: c.border }),
  header: (c) => ({ backgroundColor: c.background }),
  eyebrow: (c) => ({ color: c.accent }),
  heading: (c) => ({ color: c.text }),
  iconButton: (c) => ({ backgroundColor: c.soft }),
  card: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  title: (c) => ({ color: c.text }),
  body: (c) => ({ color: c.text }),
  muted: (c) => ({ color: c.muted }),
  secondary: (c) => ({ backgroundColor: c.accentSoft }),
  link: (c) => ({ color: c.accent }),
  danger: (c) => ({ backgroundColor: c.dangerSoft }),
  dangerText: (c) => ({ color: c.danger }),
  good: (c) => ({ backgroundColor: c.successSoft }),
  goodText: (c) => ({ color: c.success }),
  badge: (c) => ({ backgroundColor: c.accentSoft }),
  badgeText: (c) => ({ color: c.accent }),
  error: (c) => ({ color: c.danger }),
  success: (c) => ({ color: c.success }),
  label: (c) => ({ color: c.text }),
  input: (c) => ({ backgroundColor: c.elevated, borderColor: c.border, color: c.text }),
  select: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  options: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  option: (c) => ({ backgroundColor: c.surface, borderBottomColor: c.border }),
  chosen: (c) => ({ backgroundColor: c.accentSoft }),
  pagination: (c) => ({ backgroundColor: c.background, borderTopColor: c.border }),
  searchBox: (c) => ({ backgroundColor: c.surface, borderColor: c.border }),
  searchInput: (c) => ({ color: c.text }),
  listCaption: (c) => ({ color: c.muted }),
  amount: (c) => ({ color: c.accent }),
  info: (c) => ({ backgroundColor: c.accentSoft }),
  photo: (c) => ({ backgroundColor: c.elevated }),
  divider: (c) => ({ borderBottomColor: c.border }),
};

export const ui = new Proxy(baseUi, {
  get(target, property) {
    const style = Reflect.get(target, property);
    const override = themedUi[property];
    return activePalette && override
      ? [style, override(activePalette)]
      : style;
  },
});
