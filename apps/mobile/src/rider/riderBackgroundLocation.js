import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {
  observeMobileSession,
  registerSessionCleanup,
  withRiderSession,
} from "../auth/useMobileSession";

const TASK = "shopmart-rider-location-v1";
const KEY = "shopmart.rider.location.v1";
const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
const listeners = new Set();
let queue = Promise.resolve();
let generation = 0;
let snapshot = { orderId: null, userId: null, busy: false, message: "" };

function emit(changes) {
  snapshot = { ...snapshot, ...changes };
  for (const listener of listeners) listener(snapshot);
}
function serial(action) {
  const job = queue.then(action);
  queue = job.catch(() => {});
  return job;
}
async function readIntent() {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.orderId && value.userId && value.runId) return value;
  } catch {
    /* An incomplete saved intent must never start an upload. */
  }
  await SecureStore.deleteItemAsync(KEY);
  return null;
}
async function send(intent, method, coords) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");
  return withRiderSession(intent.userId, async (token) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(
        `${baseUrl}/api/mobile/rider/deliveries/${encodeURIComponent(intent.orderId)}/location`,
        {
          method,
          credentials: "omit",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(coords ? { "Content-Type": "application/json" } : {}),
          },
          body: coords ? JSON.stringify(coords) : undefined,
        },
      );
      if (!response.ok) {
        const error = new Error(
          [403, 404, 409].includes(response.status)
            ? "This delivery can no longer share location. Sharing stopped."
            : response.status === 401
              ? "Your session expired. Sign in again to share location."
              : "Location upload failed. Retrying when another GPS reading arrives.",
        );
        error.status = response.status;
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  });
}
async function stopInternal(showMessage = true) {
  const intent = await readIntent();
  await SecureStore.deleteItemAsync(KEY);
  emit({ orderId: null, userId: null });
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
  let message = "Location sharing stopped.";
  if (intent) {
    try {
      await send(intent, "DELETE");
    } catch {
      message =
        "Sharing stopped. The last server position may remain visible for up to two minutes.";
    }
  }
  if (showMessage) emit({ message });
}
export function stopRiderLocation(showMessage = true) {
  // Cancel an outstanding permission prompt immediately, before waiting for uploads.
  generation += 1;
  return serial(async () => {
    emit({ busy: true });
    try {
      await stopInternal(showMessage);
    } finally {
      emit({ busy: false });
    }
  });
}
export function subscribeRiderLocation(listener) {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}
export function synchronizeRiderLocation(userId) {
  return serial(async () => {
    const intent = await readIntent();
    if (!intent) {
      if (await Location.hasStartedLocationUpdatesAsync(TASK))
        await Location.stopLocationUpdatesAsync(TASK);
      emit({ orderId: null, userId: null });
      return;
    }
    if (intent.userId !== userId) {
      await stopInternal();
      return;
    }
    if (!(await Location.hasStartedLocationUpdatesAsync(TASK))) {
      await stopInternal(false);
      emit({ message: "GPS sharing is off. Start it again when ready." });
      return;
    }
    emit({
      userId,
      orderId: intent.orderId,
      message: "Background GPS sharing is active.",
    });
  });
}
export async function startRiderLocation(userId, delivery) {
  if (snapshot.busy) return;
  if (delivery.status !== "DISPATCHED" || delivery.warehouseReturnPending) {
    emit({
      message:
        "Location sharing is available only for an active dispatched delivery.",
    });
    return;
  }
  const stamp = ++generation;
  emit({ busy: true, message: "Checking location permissions..." });
  try {
    if (Platform.OS !== "android")
      throw new Error(
        "This background tracking setup currently supports Android.",
      );
    if (!(await TaskManager.isAvailableAsync()))
      throw new Error(
        "Install the ShopMart development APK to use background GPS. Expo Go is not supported.",
      );
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted)
      throw new Error(
        "Allow precise location access in Android settings to share your position.",
      );
    if (!(await Location.hasServicesEnabledAsync()))
      throw new Error("Turn on your phone's location services.");
    // The hook displays an explanation before this Android settings request.
    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted)
      throw new Error(
        'Choose "Allow all the time" in ShopMart location settings, then start sharing again.',
      );
    if (stamp !== generation) return;
    if (AppState.currentState !== "active")
      throw new Error("Return to ShopMart and tap Start sharing again.");
    await serial(async () => {
      if (stamp !== generation) return;
      // Confirm account ownership before starting any native location subscription.
      await withRiderSession(userId, async () => {});
      await stopInternal(false);
      if (stamp !== generation || AppState.currentState !== "active") return;
      const intent = {
        userId,
        orderId: delivery.id,
        runId: Crypto.randomUUID(),
        lastTimestamp: 0,
      };
      await SecureStore.setItemAsync(KEY, JSON.stringify(intent));
      try {
        await Location.startLocationUpdatesAsync(TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000,
          distanceInterval: 0,
          deferredUpdatesInterval: 0,
          foregroundService: {
            notificationTitle: "ShopMart delivery location",
            notificationBody:
              "Sharing your location for an active delivery. Open ShopMart to stop sharing.",
            notificationColor: "#7c3aed",
            killServiceOnDestroy: true,
          },
        });
        emit({
          userId,
          orderId: delivery.id,
          message:
            "GPS sharing is active, including when you switch apps. Waiting for a fresh position...",
        });
      } catch (error) {
        await stopInternal(false);
        throw error;
      }
    });
  } catch (error) {
    emit({ message: error.message || "Could not start background GPS." });
  } finally {
    emit({ busy: false });
  }
}

// Must be defined at module scope and imported from index.js for headless execution.
TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error) {
    emit({
      message:
        "Android could not provide GPS updates. Check location permissions and restart sharing.",
    });
    return;
  }
  const position = [...(data?.locations || [])].sort(
    (a, b) => b.timestamp - a.timestamp,
  )[0];
  if (!position) return;
  const age = Date.now() - position.timestamp;
  const { latitude, longitude, accuracy } = position.coords || {};
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    !Number.isFinite(age) ||
    age < -10000 ||
    age > 90000
  )
    return;
  await serial(async () => {
    const intent = await readIntent();
    if (!intent) {
      if (await Location.hasStartedLocationUpdatesAsync(TASK))
        await Location.stopLocationUpdatesAsync(TASK);
      return;
    }
    if (position.timestamp <= intent.lastTimestamp) return;
    try {
      await send(intent, "PUT", { latitude, longitude, accuracy });
      intent.lastTimestamp = position.timestamp;
      await SecureStore.setItemAsync(KEY, JSON.stringify(intent));
      emit({
        userId: intent.userId,
        orderId: intent.orderId,
        message: `Location sent at ${new Date().toLocaleTimeString("en-PK")}. Accuracy about ${Math.round(accuracy)} m.`,
      });
    } catch (failure) {
      if ([401, 403, 404, 409].includes(failure.status)) {
        generation += 1;
        await stopInternal(false);
      }
      emit({
        message:
          failure.message ||
          "Connection unavailable. GPS will retry with the next reading.",
      });
    }
  });
});

registerSessionCleanup(() => stopRiderLocation(false));
observeMobileSession((session) => {
  // Fingerprint locking does not end the authenticated session or stop this service.
  if (
    !session ||
    session.user.role !== "RIDER" ||
    (snapshot.userId && snapshot.userId !== session.user.id)
  ) {
    stopRiderLocation(false).catch(() =>
      emit({
        message:
          "Location sharing could not stop normally. Turn off ShopMart location permission in Android settings.",
      }),
    );
  }
});
