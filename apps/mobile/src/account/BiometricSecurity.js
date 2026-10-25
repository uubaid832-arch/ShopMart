import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Svg, { Path } from "react-native-svg";

export function useBiometricLock(userId, sessionReady) {
  const key = userId ? `shopmart.biometric.${userId}` : "";
  const keyRef = useRef(key);
  keyRef.current = key;
  const generation = useRef(0);
  const pending = useRef(false);
  const passwordFallbackFor = useRef(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    generation.current += 1;
    if (!sessionReady || !key) {
      setState(null);
      setError("");
      return;
    }
    let active = true;
    SecureStore.getItemAsync(key)
      .then((value) => {
        if (active) {
          const passwordVerifiedSession = passwordFallbackFor.current === key;
          if (passwordVerifiedSession) passwordFallbackFor.current = null;
          setState({
            key,
            enabled: value === "true",
            unlocked: value !== "true" || passwordVerifiedSession,
          });
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setState({ key, enabled: true, unlocked: false });
          setError(
            "Could not read security settings. Unlock or use password sign-in.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [key, sessionReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        generation.current += 1;
        setState((current) =>
          current?.enabled ? { ...current, unlocked: false } : current,
        );
      }
    });
    return () => subscription.remove();
  }, []);

  const checked = sessionReady && (!key || state?.key === key);
  const enabled = state?.key === key && state.enabled;
  const locked = Boolean(key) && (!checked || (enabled && !state.unlocked));

  async function verify() {
    const [hardware, enrolled, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    if (
      !hardware ||
      !enrolled ||
      level < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
    ) {
      throw new Error(
        "Set up a strong fingerprint or supported biometric in your phone's security settings first.",
      );
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock ShopMart",
      promptSubtitle: "Confirm your identity on this device",
      cancelLabel: "Cancel",
      disableDeviceFallback: true,
      biometricsSecurityLevel: "strong",
    });
    if (!result.success) {
      throw new Error(
        result.error === "lockout"
          ? "Biometrics are temporarily locked. Unlock your phone normally, then try again."
          : "Authentication was cancelled or unsuccessful. ShopMart remains protected.",
      );
    }
  }

  async function authenticate(nextEnabled) {
    if (pending.current || !checked || !key) return;
    const operationKey = key;
    const stamp = generation.current;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await verify();
      if (keyRef.current !== operationKey || generation.current !== stamp)
        return;
      if (typeof nextEnabled === "boolean") {
        await SecureStore.setItemAsync(operationKey, String(nextEnabled));
      }
      if (keyRef.current !== operationKey) return;
      setState((current) => ({
        key: operationKey,
        enabled:
          typeof nextEnabled === "boolean"
            ? nextEnabled
            : current?.enabled === true,
        unlocked: generation.current === stamp,
      }));
    } catch (failure) {
      if (keyRef.current === operationKey)
        setError(failure.message || "Could not verify biometrics.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function lockNow() {
    generation.current += 1;
    setState((current) =>
      current?.enabled ? { ...current, unlocked: false } : current,
    );
  }

  async function usePassword(clearLocalSession) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const operationKey = key;
    try {
      // End the session while preserving this account's saved preference.
      await clearLocalSession();
      // Password (and required OTP) sign-in grants access for the next session.
      // Subsequent backgrounding still locks it using the saved preference.
      passwordFallbackFor.current = operationKey;
      return true;
    } catch {
      setError("Could not finish signing out. Please try again.");
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return {
    checked,
    enabled,
    locked,
    busy,
    error,
    unlock: () => authenticate(),
    setEnabled: (value) => authenticate(value),
    lockNow,
    usePassword,
  };
}

function Fingerprint({ size = 58 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10a9 9 0 0 1 18 0M6 11a6 6 0 0 1 12 0v3m-9-3a3 3 0 0 1 6 0v3c0 4-1 6-3 8M12 11v3c0 3-1 6-3 8M6 14c0 3-1 5-2 6m14-3c0 2-.5 3-1 4M3 14v2"
        stroke="#7c3aed"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BiometricLockScreen({ security, onUsePassword }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.lockContent}>
        <View style={styles.heroIcon}>
          <Fingerprint />
        </View>
        <Text style={styles.title}>ShopMart is locked</Text>
        <Text style={styles.description}>
          Verify your identity to access your signed-in account.
        </Text>
        {!security.checked ? (
          <ActivityIndicator color="#7c3aed" style={styles.loader} />
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={security.busy}
              onPress={security.unlock}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>
                {security.busy ? "Verifying..." : "Unlock with biometrics"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={security.busy}
              onPress={onUsePassword}
              style={styles.secondary}
            >
              <Text style={styles.link}>Sign out and use password</Text>
            </Pressable>
          </>
        )}
        {security.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {security.error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default function BiometricSettingsModal({ security, onClose, onLock }) {
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!security.busy) onClose();
      }}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Fingerprint & security</Text>
            <Pressable
              accessibilityRole="button"
              disabled={security.busy}
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.heroIcon}>
              <Fingerprint />
            </View>
            <Text style={styles.title}>A safer way back in</Text>
            <Text style={styles.description}>
              Use your phone's fingerprint or supported strong biometric to
              unlock ShopMart.
            </Text>
            <Text style={styles.status}>
              {security.enabled
                ? "Enabled on this device"
                : "Currently disabled"}
            </Text>
          </View>
          <Text style={styles.description}>
            When enabled, ShopMart locks when reopened or sent to the
            background. Android chooses the supported biometric method. Your
            fingerprint stays with your phone.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={security.busy || !security.checked}
            onPress={() => security.setEnabled(!security.enabled)}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>
              {security.busy
                ? "Verifying..."
                : security.enabled
                  ? "Disable biometric unlock"
                  : "Enable biometric unlock"}
            </Text>
          </Pressable>
          {security.enabled && (
            <Pressable
              accessibilityRole="button"
              disabled={security.busy}
              onPress={onLock}
              style={styles.secondary}
            >
              <Text style={styles.link}>Lock now</Text>
            </Pressable>
          )}
          <Text style={styles.note}>
            This setting is saved separately for each account on this phone,
            including after sign-out. Password sign-in and required OTP
            verification still apply when signing in again.
          </Text>
          {security.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {security.error}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 25,
  },
  headerTitle: { flex: 1, color: "#25304a", fontSize: 21, fontWeight: "800" },
  close: { backgroundColor: "#f3effd", padding: 13, borderRadius: 12 },
  infoCard: {
    backgroundColor: "#f7f3ff",
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  heroIcon: {
    padding: 20,
    borderRadius: 30,
    backgroundColor: "#ede5fc",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    color: "#25304a",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: "#8790a6",
    fontSize: 13,
    lineHeight: 23,
    marginTop: 12,
  },
  status: { color: "#7c3aed", fontWeight: "700", marginTop: 18, fontSize: 12 },
  primary: {
    alignSelf: "stretch",
    backgroundColor: "#7c3aed",
    padding: 17,
    borderRadius: 14,
    marginTop: 24,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 13,
  },
  secondary: {
    alignSelf: "stretch",
    backgroundColor: "#f3effd",
    padding: 17,
    borderRadius: 14,
    marginTop: 12,
  },
  link: {
    color: "#7c3aed",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  note: { color: "#9aa1b2", fontSize: 11, lineHeight: 20, marginTop: 20 },
  error: { color: "#be123c", fontSize: 12, lineHeight: 21, marginTop: 18 },
  lockContent: { flex: 1, justifyContent: "center", padding: 30 },
  loader: { marginTop: 25 },
});
