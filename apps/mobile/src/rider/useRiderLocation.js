import { useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  startRiderLocation,
  stopRiderLocation,
  subscribeRiderLocation,
  synchronizeRiderLocation,
} from "./riderBackgroundLocation";

export function useRiderLocation(session) {
  const [state, setState] = useState({
    orderId: null,
    busy: false,
    message: "",
  });
  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeRiderLocation((value) => {
      if (mounted)
        setState({
          ...value,
          orderId: value.userId === session.user.id ? value.orderId : null,
        });
    });
    synchronizeRiderLocation(session.user.id).catch(() => {
      if (mounted)
        setState({
          orderId: null,
          busy: false,
          message:
            "Could not check GPS sharing. Restart ShopMart and check Android location permissions.",
        });
    });
    // This screen also unmounts behind the fingerprint lock. Keep native tracking alive.
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [session.user.id]);

  function start(delivery) {
    if (state.busy) return;
    Alert.alert(
      "Share delivery location?",
      'ShopMart will share your location with this order\'s customer while you deliver, including when using WhatsApp or locking the screen. Android will show an ongoing notification. Choose "Allow all the time" on the next location settings screen. Use Stop sharing to finish.',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => startRiderLocation(session.user.id, delivery),
        },
      ],
    );
  }
  async function stop(showMessage = true) {
    try {
      await stopRiderLocation(showMessage);
    } catch {
      setState((value) => ({
        ...value,
        message:
          "Could not stop the Android GPS service. Turn off ShopMart location permission in Android settings.",
      }));
      // The upload intent is already cleared, so no further positions are sent.
      return false;
    }
  }
  return { ...state, start, stop };
}
