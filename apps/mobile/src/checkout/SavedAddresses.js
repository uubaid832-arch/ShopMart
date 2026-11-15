import { Text, TextInput } from "../i18n/LocalizedNativeComponents.js";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View } from "react-native";
import { useMobileAppearance } from "../appearance/MobileAppearance";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export default function SavedAddresses({
  session,
  details,
  onSelect,
  disabled = false,
}) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const token = session.accessToken;
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`${baseUrl}/api/mobile/addresses`, {
          credentials: "omit",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Your session expired. Please sign in again."
              : "Could not load saved addresses.",
          );
        }

        const items = await response.json();

        if (!controller.signal.aborted) {
          setResult({ token, reload, items, error: "" });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({ token, reload, items: [], error: error.message });
        }
      }
    }

    load();
    return () => controller.abort();
  }, [token, reload]);

  const current = result?.token === token && result?.reload === reload;

  const selected = current
    ? result.items.find(
        (item) =>
          item.id === selectedId &&
          item.recipientName === details.name &&
          item.phone === details.phone &&
          item.addressLine === details.address &&
          item.city === details.city,
      )
    : null;
  const filteredItems = current
    ? result.items.filter((item) =>
        `${item.label} ${item.recipientName} ${item.phone} ${item.addressLine} ${item.city}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : [];

  function enterManually() {
    if (disabled) return;

    setSelectedId(null);
    setOpen(false);
    setManual(true);

    onSelect({
      name: "",
      phone: "",
      address: "",
      city: "",
    });
  }

  return (
    <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: palette.text }]}>Delivery address</Text>

        <Pressable
          accessibilityRole="button"
          disabled={disabled || !current}
          onPress={() => setReload((value) => value + 1)}
          style={[styles.reload, { backgroundColor: palette.accentSoft }]}
        >
          <Text style={[styles.link, { color: palette.accent }]}>Reload</Text>
        </Pressable>
      </View>

      {!current ? (
        <ActivityIndicator color="#7c3aed" />
      ) : result.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {result.error}
        </Text>
      ) : result.items.length === 0 ? (
        <Text style={[styles.muted, { color: palette.muted }]}>No saved addresses available.</Text>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a saved address"
            accessibilityState={{ expanded: open }}
            disabled={disabled}
            onPress={() => setOpen((value) => !value)}
            style={[
              styles.picker,
              { backgroundColor: palette.elevated, borderColor: palette.border },
              selected && { borderColor: palette.accent, backgroundColor: palette.accentSoft },
              disabled && styles.dim,
            ]}
          >
            <View style={styles.grow}>
              <Text style={[styles.name, { color: palette.accent }]}>
                {selected ? `✓ ${selected.label}` : "Choose a saved address"}
              </Text>

              {selected && (
                <Text style={[styles.muted, { color: palette.muted }]} numberOfLines={2}>
                  {selected.addressLine}, {selected.city}
                </Text>
              )}
            </View>

            <Text style={[styles.arrow, { color: palette.accent }]}>{open ? "▴" : "▾"}</Text>
          </Pressable>

          {open && (
            <View style={[styles.dropdown, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <TextInput
                accessibilityLabel="Search saved addresses"
                placeholder="Search by label, name, phone, city or street"
                value={search}
                onChangeText={setSearch}
                editable={!disabled}
                autoCorrect={false}
                placeholderTextColor={palette.muted}
                style={[styles.search, { backgroundColor: palette.elevated, borderColor: palette.border, color: palette.text }]}
              />
              {filteredItems.length === 0 ? (
                <Text style={[styles.muted, { color: palette.muted }]}>No saved address matches that search.</Text>
              ) : filteredItems.map((item) => {
                const active = selected?.id === item.id;

                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    disabled={disabled}
                    onPress={() => {
                      onSelect({
                        name: item.recipientName,
                        phone: item.phone,
                        address: item.addressLine,
                        city: item.city,
                      });
                      setSelectedId(item.id);
                      setManual(false);
                      setOpen(false);
                      setSearch("");
                    }}
                    style={[styles.address, { borderColor: palette.border }, active && { borderColor: palette.accent, backgroundColor: palette.accentSoft }]}
                  >
                    <View style={styles.header}>
                      <Text style={[styles.name, { color: palette.accent }, styles.grow]}>
                        {active ? "✓ " : ""}
                        {item.label}
                      </Text>

                      {item.isDefault && (
                        <Text style={[styles.defaultBadge, { color: palette.success }]}>Default</Text>
                      )}
                    </View>

                    <Text style={[styles.recipient, { color: palette.text }]}>{item.recipientName}</Text>
                    <Text style={[styles.muted, { color: palette.muted }]}>
                      {item.addressLine}, {item.city}
                    </Text>
                    <Text style={[styles.muted, { color: palette.muted }]}>{item.phone}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={enterManually}
        style={[styles.manualButton, { backgroundColor: palette.accentSoft }, disabled && styles.dim]}
      >
        <Text style={[styles.link, { color: palette.accent }]}>+ Enter address manually</Text>
      </Pressable>

      {manual && (
        <Text style={[styles.muted, { color: palette.muted }]}>
          Enter delivery details below. This address will only be used for this
          order and will not be added to your saved addresses.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#faf8ff",
    borderWidth: 1,
    borderColor: "#ede7fa",
    borderRadius: 18,
    padding: 15,
    marginTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  grow: { flex: 1 },
  heading: { color: "#25304a", fontSize: 16, fontWeight: "800" },
  reload: { padding: 10 },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5def4",
    borderRadius: 13,
    padding: 14,
    marginTop: 10,
  },
  selected: { borderColor: "#7c3aed", backgroundColor: "#ede9fe" },
  arrow: { color: "#7c3aed", fontSize: 22 },
  dropdown: {
    marginTop: 6,
    padding: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5def4",
    borderRadius: 15,
  },
  search: {
    borderWidth: 1,
    borderColor: "#e5def4",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    color: "#25304a",
    marginBottom: 8,
  },
  address: {
    borderWidth: 1,
    borderColor: "#e5def4",
    borderRadius: 12,
    padding: 13,
    marginVertical: 4,
  },
  name: { color: "#6d28d9", fontWeight: "800" },
  recipient: { color: "#334155", marginTop: 8, fontWeight: "600" },
  muted: { color: "#7c859b", fontSize: 12, lineHeight: 20, marginTop: 6 },
  defaultBadge: { color: "#15803d", fontSize: 10, fontWeight: "700" },
  manualButton: {
    backgroundColor: "#ede7fc",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 14,
  },
  dim: { opacity: 0.5 },
  error: { color: "#be123c", fontSize: 12, lineHeight: 20, marginTop: 10 },
});
