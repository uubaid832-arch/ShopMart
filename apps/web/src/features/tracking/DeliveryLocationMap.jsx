import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDeliveryLocation } from "../../api/deliveryLocations";

function RiderMap({ latitude, longitude, accuracy }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyRef = useRef(null);

  useEffect(() => {
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
    }).setView([0, 0], 1);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      accuracyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const position = [latitude, longitude];

    if (!markerRef.current) {
      markerRef.current = L.circleMarker(position, {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#7c3aed",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip("Rider’s reported location");

      accuracyRef.current = L.circle(position, {
        radius: accuracy,
        color: "#7c3aed",
        weight: 1,
        fillColor: "#7c3aed",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);

      map.setView(position, 15);
    } else {
      markerRef.current.setLatLng(position);
      accuracyRef.current.setLatLng(position).setRadius(accuracy);
    }
  }, [latitude, longitude, accuracy]);

  return (
    <div>
      <div
        ref={containerRef}
        role="region"
        aria-label="Map showing the rider’s reported location"
        dir="ltr"
        className="relative z-0 h-72 w-full overflow-hidden rounded-xl"
      />

      <button
        type="button"
        onClick={() => mapRef.current?.setView([latitude, longitude], 15)}
        className="mt-3 rounded-lg border-0 bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-200"
      >
        Centre on rider
      </button>
    </div>
  );
}

export default function DeliveryLocationMap({ token, orderId }) {
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!token || !orderId) return;

    let active = true;
    let running = false;
    let timeoutId;
    let controller;

    async function refresh() {
      if (!active || running) return;

      window.clearTimeout(timeoutId);

      if (document.visibilityState !== "visible") {
        timeoutId = window.setTimeout(refresh, 15000);
        return;
      }

      running = true;
      controller = new AbortController();
      const requestController = controller;
      const requestTimeout = window.setTimeout(
        () => requestController.abort(),
        10000,
      );

      try {
        const data = await getDeliveryLocation(
          token,
          orderId,
          requestController.signal,
        );

        if (
          !data ||
          typeof data.available !== "boolean" ||
          (data.available &&
            (!Number.isFinite(data.latitude) ||
              Math.abs(data.latitude) > 90 ||
              !Number.isFinite(data.longitude) ||
              Math.abs(data.longitude) > 180 ||
              !Number.isFinite(data.accuracy) ||
              data.accuracy < 0 ||
              !Number.isFinite(Date.parse(data.updatedAt))))
        ) {
          throw new Error("The server returned invalid location information.");
        }

        if (active) {
          setResult({ token, orderId, data, error: "" });
          setNow(Date.now());
        }
      } catch (failure) {
        if (active) {
          setResult({
            token,
            orderId,
            data: null,
            error:
              failure.name === "AbortError"
                ? "The location request timed out."
                : failure.message || "Could not load the rider’s location.",
          });
        }
      } finally {
        window.clearTimeout(requestTimeout);
        running = false;

        if (active) {
          timeoutId = window.setTimeout(refresh, 15000);
        }
      }
    }

    function checkOnReturn() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    refresh();

    const clock = window.setInterval(() => {
      setNow(Date.now());
    }, 5000);

    document.addEventListener("visibilitychange", checkOnReturn);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      window.clearInterval(clock);
      controller?.abort();
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, [token, orderId]);

  const current = result?.token === token && result?.orderId === orderId;
  const data = current ? result.data : null;
  const error = current ? result.error : "";
  const loading = Boolean(token && orderId) && !current;

  const updatedAt = data?.updatedAt ? Date.parse(data.updatedAt) : NaN;
  const age = now - updatedAt;

  const available =
    data?.available === true &&
    Number.isFinite(updatedAt) &&
    age >= -30000 &&
    age < 120000;

  const stale =
    data?.state === "STALE" || (data?.available === true && !available);

  const mapLink = available
    ? `https://www.openstreetmap.org/?mlat=${data.latitude}&mlon=${data.longitude}#map=16/${data.latitude}/${data.longitude}`
    : "";

  return (
    <section
      aria-labelledby="rider-location-title"
      className="mt-6 rounded-2xl border border-solid border-slate-200 p-4"
    >
      <h3 id="rider-location-title" className="m-0 text-base font-bold">
        Rider location
      </h3>

      <p className="mb-4 mt-2 text-xs leading-5 text-slate-500">
        Checks for updates about every 15 seconds while this tab is visible. The
        marker shows the rider’s latest reported position.
      </p>

      {loading ? (
        <p role="status" className="text-sm text-slate-500">
          Checking rider location…
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error} Another check will be attempted automatically.
        </p>
      ) : available ? (
        <>
          <RiderMap
            latitude={data.latitude}
            longitude={data.longitude}
            accuracy={data.accuracy}
          />

          <p className="mb-2 mt-3 text-xs text-slate-500">
            Last reported:{" "}
            <time dateTime={data.updatedAt}>
              {new Date(data.updatedAt).toLocaleString("en-PK")}
            </time>
            <br />
            Reported accuracy: approximately{" "}
            {Math.round(data.accuracy).toLocaleString("en-PK")} metres.
          </p>

          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-violet-700 hover:underline"
          >
            Open location in OpenStreetMap ↗
          </a>
        </>
      ) : (
        <p role="status" className="mb-0 text-sm leading-6 text-slate-500">
          {!token
            ? "Sign in to view delivery location."
            : stale
              ? "The rider’s last update is more than two minutes old. The marker is hidden until a fresh update arrives."
              : "Location is not currently available. It appears when the assigned rider shares it for a dispatched order."}
        </p>
      )}
    </section>
  );
}
