import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export default function SavedAddresses({
  session,
  details,
  onSelect,
  disabled = false,
}) {
  const token = session.accessToken;
  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [manual, setManual] = useState(false);

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
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.heading}>Delivery address</Text>

        <Pressable
          accessibilityRole="button"
          disabled={disabled || !current}
          onPress={() => setReload((value) => value + 1)}
          style={styles.reload}
        >
          <Text style={styles.link}>Reload</Text>
        </Pressable>
      </View>

      {!current ? (
        <ActivityIndicator color="#7c3aed" />
      ) : result.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {result.error}
        </Text>
      ) : result.items.length === 0 ? (
        <Text style={styles.muted}>No saved addresses available.</Text>
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
              selected && styles.selected,
              disabled && styles.dim,
            ]}
          >
            <View style={styles.grow}>
              <Text style={styles.name}>
                {selected ? `✓ ${selected.label}` : "Choose a saved address"}
              </Text>

              {selected && (
                <Text style={styles.muted} numberOfLines={2}>
                  {selected.addressLine}, {selected.city}
                </Text>
              )}
            </View>

            <Text style={styles.arrow}>{open ? "▴" : "▾"}</Text>
          </Pressable>

          {open && (
            <View style={styles.dropdown}>
              {result.items.map((item) => {
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
                    }}
                    style={[styles.address, active && styles.selected]}
                  >
                    <View style={styles.header}>
                      <Text style={[styles.name, styles.grow]}>
                        {active ? "✓ " : ""}
                        {item.label}
                      </Text>

                      {item.isDefault && (
                        <Text style={styles.defaultBadge}>Default</Text>
                      )}
                    </View>

                    <Text style={styles.recipient}>{item.recipientName}</Text>
                    <Text style={styles.muted}>
                      {item.addressLine}, {item.city}
                    </Text>
                    <Text style={styles.muted}>{item.phone}</Text>
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
        style={[styles.manualButton, disabled && styles.dim]}
      >
        <Text style={styles.link}>+ Enter address manually</Text>
      </Pressable>

      {manual && (
        <Text style={styles.muted}>
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
