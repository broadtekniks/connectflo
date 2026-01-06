import React, { useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Device } from "@twilio/voice-sdk";
import { api } from "../services/api";
import { socketService } from "../services/socket";

type WebPhoneStatus =
  | "Off"
  | "Connecting"
  | "Ready"
  | "Incoming"
  | "In call"
  | "Error";

const WebPhoneBar: React.FC = () => {
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<any>(null);

  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<WebPhoneStatus>("Off");
  const [error, setError] = useState<string | null>(null);
  const [dialTo, setDialTo] = useState<string>("");
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(false);

  const canCall = useMemo(() => {
    const s = status;
    return (
      enabled && (s === "Ready" || s === "In call") && dialTo.trim().length > 0
    );
  }, [enabled, status, dialTo]);

  const cleanupDevice = () => {
    try {
      activeCallRef.current?.disconnect?.();
    } catch {
      // ignore
    }
    activeCallRef.current = null;

    try {
      deviceRef.current?.destroy?.();
    } catch {
      // ignore
    }
    deviceRef.current = null;

    setIncomingFrom(null);
    setMuted(false);
  };

  const setSocketReady = (ready: boolean) => {
    try {
      socketService.setWebPhoneReady(ready);
    } catch {
      // ignore
    }
  };

  const enable = async () => {
    setError(null);
    setStatus("Connecting");

    try {
      const { token } = await api.twilio.getVoiceToken();

      const device = new Device(token, {
        // Keep defaults; avoid aggressive logging in production.
        logLevel: 1,
      } as any);

      device.on("registered", () => {
        setStatus("Ready");
        setSocketReady(true);
      });

      device.on("unregistered", () => {
        setSocketReady(false);
        setStatus("Off");
      });

      device.on("error", (e: any) => {
        setSocketReady(false);
        setStatus("Error");
        setError(String(e?.message || "Web phone error"));
      });

      device.on("incoming", (call: any) => {
        activeCallRef.current = call;
        setIncomingFrom(String(call?.parameters?.From || "Unknown"));
        setStatus("Incoming");
      });

      device.on("tokenWillExpire", async () => {
        try {
          const next = await api.twilio.getVoiceToken();
          device.updateToken(next.token);
        } catch (e) {
          console.warn("Failed to refresh Twilio voice token", e);
        }
      });

      await device.register();

      deviceRef.current = device;
      setEnabled(true);
    } catch (e) {
      cleanupDevice();
      setEnabled(false);
      setSocketReady(false);
      setStatus("Error");
      setError(e instanceof Error ? e.message : "Failed to start web phone");
    }
  };

  const disable = async () => {
    setEnabled(false);
    setSocketReady(false);
    cleanupDevice();
    setStatus("Off");
  };

  const answer = async () => {
    const call = activeCallRef.current;
    if (!call) return;

    try {
      setError(null);
      call.accept();
      setStatus("In call");

      call.on?.("disconnect", () => {
        activeCallRef.current = null;
        setIncomingFrom(null);
        setMuted(false);
        setStatus(enabled ? "Ready" : "Off");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to answer");
    }
  };

  const reject = async () => {
    const call = activeCallRef.current;
    if (!call) return;

    try {
      call.reject();
    } finally {
      activeCallRef.current = null;
      setIncomingFrom(null);
      setMuted(false);
      setStatus(enabled ? "Ready" : "Off");
    }
  };

  const hangup = async () => {
    const call = activeCallRef.current;
    if (!call) return;

    try {
      call.disconnect();
    } finally {
      activeCallRef.current = null;
      setIncomingFrom(null);
      setMuted(false);
      setStatus(enabled ? "Ready" : "Off");
    }
  };

  const toggleMute = () => {
    const call = activeCallRef.current;
    if (!call) return;

    const next = !muted;
    try {
      call.mute?.(next);
      setMuted(next);
    } catch {
      // ignore
    }
  };

  const startOutbound = async () => {
    const device = deviceRef.current;
    if (!device) return;

    try {
      setError(null);
      const call = await (device as any).connect({
        params: { To: dialTo.trim() },
      });
      activeCallRef.current = call;
      setStatus("In call");

      call.on?.("disconnect", () => {
        activeCallRef.current = null;
        setMuted(false);
        setStatus(enabled ? "Ready" : "Off");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
    }
  };

  useEffect(() => {
    return () => {
      setSocketReady(false);
      cleanupDevice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3">
      <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
        <Phone size={16} />
        <span>Web Phone</span>
      </div>

      <div className="text-xs text-slate-500">Status: {status}</div>

      <div className="flex-1" />

      {status === "Incoming" ? (
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-600">
            Incoming: {incomingFrom || "Unknown"}
          </div>
          <button
            type="button"
            onClick={answer}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
          >
            Answer
          </button>
          <button
            type="button"
            onClick={reject}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
          >
            Decline
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="+15551234567"
            value={dialTo}
            onChange={(e) => setDialTo(e.target.value)}
            className="w-44 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />

          {status === "In call" ? (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 inline-flex items-center gap-2"
              >
                {muted ? <MicOff size={14} /> : <Mic size={14} />}
                {muted ? "Unmute" : "Mute"}
              </button>
              <button
                type="button"
                onClick={hangup}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 inline-flex items-center gap-2"
              >
                <PhoneOff size={14} />
                Hang up
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startOutbound}
              disabled={!canCall || status !== "Ready"}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors ${
                !canCall || status !== "Ready"
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              <Phone size={14} />
              Call
            </button>
          )}

          {!enabled ? (
            <button
              type="button"
              onClick={enable}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
            >
              Enable
            </button>
          ) : (
            <button
              type="button"
              onClick={disable}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
            >
              Disable
            </button>
          )}
        </div>
      )}

      {error && <div className="ml-3 text-xs text-red-600">{error}</div>}
    </div>
  );
};

export default WebPhoneBar;
