import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";

export default function VoiceSearchButton({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;

      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onnomatch = null;
        recognition.abort();
      }
    };
  }, []);

  function toggleListening() {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Voice search is unavailable in this browser. Please type your search.",
      );
      return;
    }

    if (!window.isSecureContext) {
      setMessage(
        "Voice search requires HTTPS or localhost. Please type your search.",
      );
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-PK";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();

      if (text) {
        onTranscript(text);
        setMessage("");
      } else {
        setMessage("No words were recognized. Please try again.");
      }
    };

    recognition.onnomatch = () => {
      setMessage("Could not recognize that. Please try again.");
    };

    recognition.onerror = (event) => {
      const messages = {
        "not-allowed":
          "Microphone access was denied. Allow it in your browser settings.",
        "service-not-allowed": "Speech recognition is blocked by your browser.",
        "audio-capture":
          "No microphone was found. Check your microphone connection.",
        "no-speech":
          "No speech was detected. Tap the microphone and try again.",
        network:
          "Speech recognition could not connect. Check your internet connection.",
        "language-not-supported":
          "This speech language is unavailable in your browser.",
      };

      if (event.error !== "aborted") {
        setMessage(
          messages[event.error] ??
            "Voice search failed. Please try again or type your search.",
        );
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    setMessage("");
    setListening(true);

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setMessage("Could not start voice search. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleListening}
        aria-label={listening ? "Stop voice search" : "Search by voice"}
        aria-pressed={listening}
        title={listening ? "Stop listening" : "Search by voice"}
        className={`absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl border-0 ${
          listening
            ? "bg-rose-600 text-white"
            : "bg-transparent text-slate-500 hover:bg-violet-100 hover:text-violet-700"
        }`}
      >
        {listening ? (
          <Square size={16} aria-hidden="true" />
        ) : (
          <Mic size={19} aria-hidden="true" />
        )}
      </button>

      {(listening || message) && (
        <div className="absolute right-0 top-full z-30 mt-2 box-border flex w-full items-start gap-3 rounded-xl border border-solid border-slate-200 bg-white p-3 shadow-lg">
          <p role="status" className="m-0 flex-1 text-sm text-slate-600">
            {listening ? "Listening… Say a product name in English." : message}
          </p>

          {!listening && (
            <button
              type="button"
              aria-label="Dismiss voice search message"
              onClick={() => setMessage("")}
              className="grid size-6 shrink-0 place-items-center rounded-lg border-0 bg-slate-100 text-slate-600"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
