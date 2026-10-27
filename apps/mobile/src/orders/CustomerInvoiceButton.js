import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { apiBaseUrl } from "../admin/adminApi";
import { Button } from "../admin/adminUi";

export default function CustomerInvoiceButton({ session, orderId, disabled }) {
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
    <Button
      title={busy ? "Preparing invoice..." : "Download invoice"}
      icon="download"
      secondary
      disabled={disabled || busy}
      onPress={download}
    />
  );
}
