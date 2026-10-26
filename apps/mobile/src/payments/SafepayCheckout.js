import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useSafepay } from "./useSafepay";
export default function SafepayCheckout({ session, request, onPaid, onBack }) {
  const pay = useSafepay(session, onPaid);
  const [show, setShow] = useState(false);
  const [webError, setWebError] = useState("");
  function navigation(event) {
    try {
      const url = new URL(event.url);
      if (
        url.hostname === "sandbox.api.getsafepay.com" &&
        ["/embedded/external/complete", "/embedded/external/error"].includes(
          url.pathname,
        )
      ) {
        setShow(false);
        pay.check();
        return false;
      }
      if (url.pathname === "/api/checkout/safepay/return") {
        setShow(false);
        pay.check();
        return false;
      }
      return url.protocol === "https:" || event.url === "about:blank";
    } catch {
      return false;
    }
  }
  const url = pay.data?.checkoutUrl;
  const trusted =
    url && new URL(url).origin === "https://sandbox.api.getsafepay.com";
  const button = (title, fn, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={fn}
      disabled={disabled}
      style={[s.button, disabled && { opacity: 0.4 }]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (show) {
          setShow(false);
          pay.check();
        } else if (!pay.busy)
          onBack(
            Boolean(
              pay.id && !["CANCELLED", "REFUNDED"].includes(pay.data?.state),
            ),
          );
      }}
    >
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <Text style={s.title}>Safepay sandbox</Text>
          {button(
            show ? "Back" : "Close",
            () => {
              if (show) {
                setShow(false);
                pay.check();
              } else
                onBack(
                  Boolean(
                    pay.id &&
                    !["CANCELLED", "REFUNDED"].includes(pay.data?.state),
                  ),
                );
            },
            pay.busy,
          )}
        </View>
        {show && trusted ? (
          <>
            <WebView
              source={{ uri: url }}
              onShouldStartLoadWithRequest={navigation}
              onError={() =>
                setWebError(
                  "Checkout could not load. Return and check payment before retrying.",
                )
              }
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              setSupportMultipleWindows={false}
              startInLoadingState
              renderLoading={() => <ActivityIndicator color="#7c3aed" />}
              style={{ flex: 1 }}
            />
            {webError ? <Text style={s.error}>{webError}</Text> : null}
          </>
        ) : (
          <ScrollView contentContainerStyle={s.content}>
            <Text style={s.notice}>
              Test mode — no real money is charged. Use Safepay test cards only.
            </Text>
            {!pay.ready ? (
              <ActivityIndicator color="#7c3aed" />
            ) : !pay.data ? (
              button(
                pay.busy ? "Preparing checkout…" : "Prepare Safepay checkout",
                () => pay.start(request),
                pay.busy,
              )
            ) : (
              <>
                <Text style={s.amount}>
                  PKR{" "}
                  {Number(pay.data.total).toLocaleString("en-PK", {
                    minimumFractionDigits: 2,
                  })}
                </Text>
                <Text style={s.body}>{pay.data.message}</Text>
                <Text selectable style={s.reference}>
                  Checkout reference: {pay.data.id}
                </Text>
                {pay.data.state === "PENDING" &&
                  button(
                    "Open Safepay secure checkout",
                    async () => {
                      setWebError("");
                      const value = await pay.resume();
                      if (value?.state === "PENDING") setShow(true);
                    },
                    pay.busy || !trusted,
                  )}
                {["PENDING", "REVIEW"].includes(pay.data.state) &&
                  button(
                    pay.busy ? "Checking payment…" : "Check payment",
                    pay.check,
                    pay.busy,
                  )}
                {["CANCELLED", "REFUNDED"].includes(pay.data.state) &&
                  button("Return to checkout", async () => {
                    await pay.reset();
                    onBack(false);
                  })}
              </>
            )}
            {pay.error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {pay.error}
              </Text>
            ) : null}
            <Text style={s.body}>
              After payment, return here. ShopMart verifies the status with
              Safepay before placing your order. Closing a window alone does not
              cancel a payment.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#faf8ff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#38214d" },
  content: { padding: 20, gap: 16 },
  notice: {
    backgroundColor: "#fff2d5",
    color: "#875a00",
    padding: 15,
    borderRadius: 13,
    lineHeight: 21,
  },
  button: {
    backgroundColor: "#7c3aed",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  amount: { fontSize: 25, color: "#7c3aed", fontWeight: "800" },
  body: { color: "#776284", lineHeight: 23 },
  reference: { color: "#9a88a5", fontSize: 11 },
  error: { color: "#b63257", padding: 12, lineHeight: 20 },
});
