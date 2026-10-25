import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const mapPage = {
  baseUrl: "https://shopmart-i67s.onrender.com/",
  html: `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport"
    content="width=device-width,initial-scale=1,maximum-scale=1">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html,body,#map {
      width:100%;
      height:100%;
      margin:0;
      padding:0;
    }
    body { background:#f1f5f9; }
    .leaflet-control-attribution { font-size:9px; }
    #warning {
      display:none;
      position:absolute;
      bottom:25px;
      left:10px;
      right:10px;
      z-index:1000;
      padding:8px;
      border-radius:8px;
      background:#fff;
      color:#be123c;
      font:11px sans-serif;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="warning">Some map tiles could not load. Check your connection.</div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    function send(value) {
      window.ReactNativeWebView.postMessage(JSON.stringify(value));
    }

    try {
      var map = L.map("map", {
        zoomControl:true,
        attributionControl:true
      }).setView([0,0],2);

      var tiles = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom:19,
          attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
      ).addTo(map);

      tiles.on("tileerror", function() {
        document.getElementById("warning").style.display = "block";
      });

      var marker;
      var accuracyCircle;
      var latestPosition;

      window.updateRider = function(data) {
        var position = [data.latitude,data.longitude];
        latestPosition = position;

        if (!marker) {
          marker = L.circleMarker(position, {
            radius:10,
            color:"#ffffff",
            weight:3,
            fillColor:"#7c3aed",
            fillOpacity:1
          }).addTo(map).bindTooltip("Rider's latest reported position");

          accuracyCircle = L.circle(position, {
            radius:data.accuracy,
            color:"#7c3aed",
            weight:1,
            fillOpacity:0.1,
            interactive:false
          }).addTo(map);

          map.setView(position,15);
        } else {
          marker.setLatLng(position);
          accuracyCircle.setLatLng(position).setRadius(data.accuracy);
        }
      };

      window.centerRider = function() {
        if (latestPosition) map.setView(latestPosition,15);
      };

      window.addEventListener("resize", function() {
        map.invalidateSize();
      });

      document.addEventListener("click", function(event) {
        var link = event.target.closest("a");
        if (link) {
          event.preventDefault();
          send({type:"link",url:link.href});
        }
      });

      send({type:"ready"});
    } catch (error) {
      send({type:"error"});
    }
  </script>
</body>
</html>
`,
};

export default function RiderMap({ latitude, longitude, accuracy }) {
  const web = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (ready || error) return;

    const timer = setTimeout(() => {
      setError("The map took too long to load. Check your connection.");
    }, 25000);

    return () => clearTimeout(timer);
  }, [ready, error, attempt]);

  useEffect(() => {
    if (
      !ready ||
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180 ||
      !Number.isFinite(accuracy) ||
      accuracy < 0
    ) {
      return;
    }

    const position = JSON.stringify({ latitude, longitude, accuracy });

    web.current?.injectJavaScript(
      `window.updateRider && window.updateRider(${position}); true;`,
    );
  }, [ready, latitude, longitude, accuracy]);

  function retry() {
    setReady(false);
    setError("");
    setAttempt((value) => value + 1);
  }

  function handleMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === "ready") {
        setError("");
        setReady(true);
      } else if (message.type === "error") {
        setError("Could not load the map.");
      } else if (
        message.type === "link" &&
        message.url === "https://www.openstreetmap.org/copyright"
      ) {
        Linking.openURL(message.url).catch(() => {});
      }
    } catch {
      // Ignore unexpected messages from the map.
    }
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.fallback}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={styles.button}
          >
            <Text style={styles.link}>Retry map</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.mapFrame}>
          <WebView
            key={attempt}
            ref={web}
            source={mapPage}
            originWhitelist={["*"]}
            javaScriptEnabled
            geolocationEnabled={false}
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            mixedContentMode="never"
            applicationNameForUserAgent="ShopMart/1.0"
            onMessage={handleMessage}
            onError={() => setError("Could not load the map.")}
            onRenderProcessGone={() => setError("Map closed. Tap Retry map.")}
            onShouldStartLoadWithRequest={({ url }) =>
              url === "about:blank" || url === mapPage.baseUrl
            }
            style={styles.map}
          />

          {!ready && (
            <View pointerEvents="none" style={styles.loading}>
              <ActivityIndicator color="#7c3aed" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
        </View>
      )}

      {ready && !error && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            web.current?.injectJavaScript(
              "window.centerRider && window.centerRider(); true;",
            )
          }
          style={styles.button}
        >
          <Text style={styles.link}>Centre on rider</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  mapFrame: {
    height: 270,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
  },
  map: { flex: 1, backgroundColor: "#f1f5f9" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: { color: "#7c859b", fontSize: 12, marginTop: 10 },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#ede9fe",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  link: { color: "#7c3aed", fontSize: 12, fontWeight: "700" },
  fallback: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 20,
  },
  error: { color: "#be123c", fontSize: 12, lineHeight: 21 },
});
