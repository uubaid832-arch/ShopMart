import { useEffect, useRef, useState } from "react";
import { MapPin, Square } from "lucide-react";
import {
  updateDeliveryLocation,
  stopDeliveryLocation,
} from "../../api/deliveryLocations";

function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });
  });
}

function locationError(error) {
  if (error.code === 1) {
    return "Location permission was denied. Allow location access in your browser settings.";
  }

  if (error.code === 2) {
    return "Your location is unavailable. Enable device location services and try again.";
  }

  if (error.code === 3) {
    return "Finding your location took too long. Please try again.";
  }

  return error.message || "Could not share your location.";
}

export default function RiderLocationSharing({
  token,
  orderId,
  disabled = false,
}) {
  const [sharing, setSharing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);

  const tokenRef = useRef(token);
  const queueRef = useRef(Promise.resolve());
  const mountedRef = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sharing || disabled || !token) return;

    let active = true;
    let timeoutId;

    function schedule() {
      if (active) {
        timeoutId = window.setTimeout(sendLocation, 15000);
      }
    }

    function sendLocation() {
      queueRef.current = queueRef.current
        .catch(() => {})
        .then(async () => {
          if (!active) return;

          const position = await getPosition();
          if (!active) return;

          await updateDeliveryLocation(tokenRef.current, orderId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });

          if (active && mountedRef.current) {
            setLastUpdate(new Date());
          }
        })
        .then(schedule)
        .catch((failure) => {
          if (active && mountedRef.current) {
            setError(locationError(failure));
            setSharing(false);
          }
        });
    }

    sendLocation();

    return () => {
      active = false;
      window.clearTimeout(timeoutId);

      // Delete after an outstanding upload finishes, so it cannot
      // recreate the location after the stop request.
      queueRef.current = queueRef.current
        .catch(() => {})
        .then(() => stopDeliveryLocation(tokenRef.current, orderId))
        .catch(() => {
          if (mountedRef.current) {
            setError(
              "Location collection stopped, but removal could not be confirmed. The last server update expires after two minutes.",
            );
          }
        })
        .finally(() => {
          if (mountedRef.current) setStopping(false);
        });
    };
  }, [sharing, disabled, token, orderId]);

  function start() {
    if (disabled || stopping || !token) return;

    if (!window.isSecureContext) {
      setError(
        "Location sharing requires HTTPS or localhost. A phone cannot share location through an ordinary HTTP LAN address.",
      );
      return;
    }

    if (!navigator.geolocation) {
      setError("Location sharing is not supported by this browser.");
      return;
    }

    setError("");
    setLastUpdate(null);
    setSharing(true);
  }

  function stop() {
    setStopping(true);
    setSharing(false);
  }

  const active = sharing && !disabled && Boolean(token);

  return (
    <section className="mt-4 rounded-xl border border-solid border-slate-200 bg-slate-50 p-4">
      <h3 className="m-0 text-sm font-bold">Live location</h3>

      <p className="mb-3 mt-2 text-xs leading-5 text-slate-500">
        Share your device location with this order’s customer and store
        administrators. Keep this page open; background sharing is not
        guaranteed.
      </p>

      <button
        type="button"
        disabled={stopping || (!active && (disabled || !token))}
        onClick={active ? stop : start}
        className={`flex items-center gap-2 rounded-xl border-0 px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
          active ? "bg-rose-50 text-rose-700" : "bg-violet-100 text-violet-700"
        }`}
      >
        {active ? (
          <Square size={16} aria-hidden="true" />
        ) : (
          <MapPin size={18} aria-hidden="true" />
        )}

        {stopping
          ? "Stopping…"
          : active
            ? "Stop sharing location"
            : "Share my location"}
      </button>

      <p role="status" className="mb-0 mt-3 text-xs text-slate-500">
        {active
          ? lastUpdate
            ? `Last sent: ${lastUpdate.toLocaleTimeString("en-PK")}. Updates are requested about every 15 seconds.`
            : "Waiting for location permission or a device location…"
          : disabled
            ? "Sharing is unavailable while delivery actions are blocked."
            : "Location collection is off."}
      </p>

      {error && (
        <p role="alert" className="mb-0 mt-3 text-xs leading-5 text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}
