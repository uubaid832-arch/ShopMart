import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMobileAppearance } from "../appearance/MobileAppearance";
import { translateToUrdu } from "../api/translation";

export default function TranslatorModal({ visible, onClose }) {
  const { colors } = useMobileAppearance();
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleTranslate() {
    setBusy(true);
    setError("");
    setTranslatedText("");
    try {
      setTranslatedText(await translateToUrdu(sourceText));
    } catch (translationError) {
      setError(translationError.message || "Could not translate this text.");
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setSourceText("");
    setTranslatedText("");
    setError("");
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.header}>
              <View style={[styles.languageBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.languageBadgeText, { color: colors.accent }]}>EN → اردو</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close translator" onPress={onClose} style={[styles.close, { backgroundColor: colors.soft }]}>
                <Text style={[styles.closeText, { color: colors.text }]}>×</Text>
              </Pressable>
            </View>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>SHOPMART TRANSLATOR</Text>
            <Text style={[styles.title, { color: colors.text }]}>English to Urdu</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Enter English text to get an Urdu translation.</Text>

            <Text style={[styles.label, { color: colors.text }]}>English text</Text>
            <TextInput
              accessibilityLabel="English text to translate"
              value={sourceText}
              onChangeText={(value) => { setSourceText(value); setTranslatedText(""); setError(""); }}
              placeholder="Type or paste text here..."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={3000}
              textAlignVertical="top"
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            />
            <Text style={[styles.counter, { color: colors.muted }]}>{sourceText.length}/3000</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Translate text to Urdu"
              disabled={busy || !sourceText.trim()}
              onPress={handleTranslate}
              style={[styles.translateButton, { backgroundColor: colors.accent }, (busy || !sourceText.trim()) && styles.disabled]}
            >
              <Text style={styles.translateButtonText}>{busy ? "Translating..." : "Translate to Urdu"}</Text>
            </Pressable>

            {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger, backgroundColor: colors.dangerSoft }]}>{error}</Text> : null}

            {translatedText ? (
              <View style={[styles.result, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                <View style={styles.resultHeader}>
                  <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Urdu translation</Text>
                  <Pressable accessibilityRole="button" onPress={clear}>
                    <Text style={[styles.clear, { color: colors.accent }]}>Clear</Text>
                  </Pressable>
                </View>
                <Text accessibilityLiveRegion="polite" style={[styles.translatedText, { color: colors.text }]}>{translatedText}</Text>
              </View>
            ) : null}

            <Text style={[styles.disclaimer, { color: colors.muted }]}>Machine translation can make mistakes. Review important details before using them.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 18 },
  panel: { borderWidth: 1, borderRadius: 25, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  languageBadge: { minHeight: 40, paddingHorizontal: 12, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  languageBadgeText: { fontSize: 13, fontWeight: "900" },
  close: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 25, lineHeight: 29 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { marginTop: 5, fontSize: 27, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  label: { marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 140, padding: 13, borderWidth: 1, borderRadius: 15, fontSize: 14, lineHeight: 21 },
  counter: { marginTop: 5, textAlign: "right", fontSize: 11 },
  translateButton: { minHeight: 49, marginTop: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  translateButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  error: { marginTop: 13, padding: 12, overflow: "hidden", borderRadius: 12, fontSize: 12, lineHeight: 18 },
  result: { marginTop: 16, padding: 14, borderWidth: 1, borderRadius: 15 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clear: { fontSize: 12, fontWeight: "800" },
  translatedText: { marginTop: 8, textAlign: "right", writingDirection: "rtl", fontSize: 16, lineHeight: 29 },
  disclaimer: { marginTop: 15, fontSize: 11, lineHeight: 17 },
});
