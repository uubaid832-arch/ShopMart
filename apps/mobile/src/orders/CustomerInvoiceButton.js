import { Text } from "../i18n/LocalizedNativeComponents.js";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text as NativeText } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { apiBaseUrl } from "../admin/adminApi";
import Svg, { Path } from "react-native-svg";
import { useMobileAppearance } from "../appearance/MobileAppearance";

export default function CustomerInvoiceButton({ session, orderId, disabled }) {
  const { theme } = useMobileAppearance();
  const palette = theme.colors;
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const lifecycle = useRef({ active: true, controller: null });
  useEffect(() => {
    const current = { active: true, controller: null };
    lifecycle.current = current;
    return () => {
      current.active = false;
      current.controller?.abort();
    };
  }, [session.accessToken, orderId]);
  async function download() {
    if (pending.current) return;
    pending.current = true;
    const current = lifecycle.current;
    setBusy(true);
    const controller = new AbortController();
    current.controller = controller;
    const timer = setTimeout(() => controller.abort(), 60000);
    let file;
    try {
      if (Platform.OS === "web")
        throw new Error(
          "Use the ShopMart website to download invoices in a browser.",
        );
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("File sharing is unavailable on this phone.");
      const response = await fetch(
        `${apiBaseUrl}/api/mobile/orders/${encodeURIComponent(orderId)}/invoice`,
        {
          credentials: "omit",
          headers: { Authorization: `Bearer ${session.accessToken}` },
          signal: controller.signal,
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Sign in again to download this invoice."
            : `Invoice download failed (HTTP ${response.status}).`,
        );
      if (!response.headers.get("content-type")?.includes("application/pdf"))
        throw new Error("The server did not return a PDF invoice.");
      if (!current.active) return;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        bytes.length < 5 ||
        String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-"
      )
        throw new Error("The invoice file was invalid. Try again.");
      if (!current.active) return;
      file = new File(
        Paths.cache,
        `ShopMart-Invoice-${orderId}-${Date.now()}.pdf`,
      );
      await file.create();
      await file.write(bytes);
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Save or share invoice",
      });
    } catch (error) {
      Alert.alert(
        "Invoice",
        error.message || "Unable to download the invoice.",
      );
    } finally {
      clearTimeout(timer);
      // Cached PDFs are managed by the operating system.
      pending.current = false;
      if (current.active) setBusy(false);
    }
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={busy ? "Preparing invoice" : "Download invoice"}
      disabled={disabled || busy}
      onPress={download}
      style={[styles.button, { backgroundColor: palette.accentSoft, borderColor: palette.border }, (disabled || busy) && styles.disabled]}
    >
      {busy ? <ActivityIndicator size="small" color={palette.accent} /> : (
        <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3v12m0 0 5-5m-5 5-5-5M4 17v4h16v-4" stroke={palette.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      <Text style={[styles.label, { color: palette.accent }]}>{busy ? "Preparing invoice..." : "Download invoice"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 46, alignSelf: "stretch", borderWidth: 1, borderRadius: 13, marginVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  label: { fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
