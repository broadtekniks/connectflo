import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  X,
  Delete,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
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

type RecentCallDirection = "in" | "out";
type RecentCallStatus =
  | "ringing"
  | "dialing"
  | "completed"
  | "missed"
  | "declined"
  | "failed";

type RecentCall = {
  id: string;
  direction: RecentCallDirection;
  number: string;
  status: RecentCallStatus;
  at: number;
  durationSec?: number;
};

const RECENTS_STORAGE_KEY = "connectflo:webPhoneRecents:v1";
const MAX_RECENTS = 20;

const safeParseRecents = (raw: string | null): RecentCall[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        id: String(x.id || ""),
        direction: (x.direction === "in" ? "in" : "out") as RecentCallDirection,
        number: String(x.number || ""),
        status: String(x.status || "completed") as RecentCallStatus,
        at: Number(x.at || Date.now()),
        durationSec: (() => {
          if (x.durationSec === undefined || x.durationSec === null)
            return undefined;
          const n = Number(x.durationSec);
          return Number.isFinite(n) ? n : undefined;
        })(),
      }))
      .filter((x) => x.id && x.number);
  } catch {
    return [];
  }
};

const formatRelativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 30_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const WebPhoneDialer: React.FC<{ featureEnabled: boolean }> = ({
  featureEnabled,
}) => {
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<any>(null);
  const enabledRef = useRef<boolean>(false);
  const activeRecentIdRef = useRef<string | null>(null);
  const activeCallStartAtRef = useRef<number | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<WebPhoneStatus>("Off");
  const [error, setError] = useState<string | null>(null);
  const [dialTo, setDialTo] = useState<string>("");
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [recents, setRecents] = useState<RecentCall[]>(() =>
    safeParseRecents(window?.localStorage?.getItem(RECENTS_STORAGE_KEY) || null)
  );

  const persistRecents = (next: RecentCall[]) => {
    setRecents(next);
    try {
      window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const updateRecents = (updater: (prev: RecentCall[]) => RecentCall[]) => {
    setRecents((prev) => {
      const next = updater(prev);
      try {
        window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const upsertRecent = (patch: Partial<RecentCall> & { id: string }) => {
    updateRecents((prev) => {
      const idx = prev.findIndex((r) => r.id === patch.id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch } as RecentCall;
      return next;
    });
  };

  const addRecent = (item: Omit<RecentCall, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry: RecentCall = { id, ...item };
    updateRecents((prev) => {
      const next = [entry, ...prev].slice(0, MAX_RECENTS);
      return next;
    });
    return id;
  };

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const setSocketReady = (ready: boolean) => {
    try {
      socketService.setWebPhoneReady(ready);
    } catch {
      // ignore
    }
  };

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

    activeRecentIdRef.current = null;
    activeCallStartAtRef.current = null;

    setIncomingFrom(null);
    setMuted(false);
  };

  const enable = async () => {
    if (!featureEnabled) {
      setStatus("Error");
      setError("Web Phone is disabled by your admin.");
      setIsOpen(true);
      return;
    }

    setError(null);
    setStatus("Connecting");

    try {
      const { token, identity } = await api.twilio.getVoiceToken();

      const device = new Device(token, {
        logLevel: 1,
        identity,
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
        const from = String(call?.parameters?.From || "Unknown");
        setIncomingFrom(from);
        setStatus("Incoming");
        setIsOpen(true);

        activeRecentIdRef.current = addRecent({
          direction: "in",
          number: from,
          status: "ringing",
          at: Date.now(),
        });

        call.on?.("cancel", () => {
          const id = activeRecentIdRef.current;
          if (id) upsertRecent({ id, status: "missed" });
          activeRecentIdRef.current = null;
          activeCallStartAtRef.current = null;
        });

        call.on?.("disconnect", () => {
          const id = activeRecentIdRef.current;
          const started = activeCallStartAtRef.current;
          if (id) {
            if (started) {
              upsertRecent({
                id,
                status: "completed",
                durationSec: Math.max(
                  0,
                  Math.round((Date.now() - started) / 1000)
                ),
              });
            } else {
              upsertRecent({ id, status: "missed" });
            }
          }

          activeCallRef.current = null;
          setIncomingFrom(null);
          setMuted(false);
          setStatus(enabledRef.current ? "Ready" : "Off");

          activeRecentIdRef.current = null;
          activeCallStartAtRef.current = null;
        });
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
      setIsOpen(true);
    } catch (e) {
      cleanupDevice();
      setEnabled(false);
      setSocketReady(false);
      setStatus("Error");
      setError(e instanceof Error ? e.message : "Failed to start web phone");
      setIsOpen(true);
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
      activeCallStartAtRef.current = Date.now();
      const id = activeRecentIdRef.current;
      if (id) upsertRecent({ id, status: "completed" });
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
      const id = activeRecentIdRef.current;
      if (id) upsertRecent({ id, status: "declined" });

      activeCallRef.current = null;
      setIncomingFrom(null);
      setMuted(false);
      setStatus(enabledRef.current ? "Ready" : "Off");

      activeRecentIdRef.current = null;
      activeCallStartAtRef.current = null;
    }
  };

  const hangup = async () => {
    const call = activeCallRef.current;
    if (!call) return;

    try {
      call.disconnect();
    } finally {
      const id = activeRecentIdRef.current;
      const started = activeCallStartAtRef.current;
      if (id && started) {
        upsertRecent({
          id,
          status: "completed",
          durationSec: Math.max(0, Math.round((Date.now() - started) / 1000)),
        });
      }

      activeCallRef.current = null;
      setIncomingFrom(null);
      setMuted(false);
      setStatus(enabledRef.current ? "Ready" : "Off");

      activeRecentIdRef.current = null;
      activeCallStartAtRef.current = null;
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

      const number = dialTo.trim();
      const recentId = addRecent({
        direction: "out",
        number,
        status: "dialing",
        at: Date.now(),
      });
      activeRecentIdRef.current = recentId;
      activeCallStartAtRef.current = Date.now();

      const call = await (device as any).connect({
        params: { To: number },
      });
      activeCallRef.current = call;
      setStatus("In call");

      call.on?.("disconnect", () => {
        const id = activeRecentIdRef.current;
        const started = activeCallStartAtRef.current;
        if (id && started) {
          upsertRecent({
            id,
            status: "completed",
            durationSec: Math.max(0, Math.round((Date.now() - started) / 1000)),
          });
        }
        activeCallRef.current = null;
        setMuted(false);
        setStatus(enabledRef.current ? "Ready" : "Off");

        activeRecentIdRef.current = null;
        activeCallStartAtRef.current = null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
      const id = activeRecentIdRef.current;
      if (id) upsertRecent({ id, status: "failed" });
      activeRecentIdRef.current = null;
      activeCallStartAtRef.current = null;
    }
  };

  const appendToDialTo = (ch: string) => {
    setDialTo((prev) => `${prev}${ch}`);
  };

  const backspaceDialTo = () => {
    setDialTo((prev) => prev.slice(0, -1));
  };

  const clearDialTo = () => {
    setDialTo("");
  };

  const readyDotClass = useMemo(() => {
    if (!enabled) return "bg-slate-300";
    if (status === "Ready" || status === "In call" || status === "Incoming") {
      return "bg-green-500";
    }
    if (status === "Error") return "bg-red-500";
    return "bg-slate-400";
  }, [enabled, status]);

  const canCall = useMemo(() => {
    return enabled && status === "Ready" && dialTo.trim().length > 0;
  }, [enabled, status, dialTo]);

  useEffect(() => {
    if (!isOpen) return;
    if (enabledRef.current) return;
    if (!featureEnabled) return;
    if (status === "Connecting") return;
    void enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, featureEnabled]);

  useEffect(() => {
    return () => {
      setSocketReady(false);
      cleanupDevice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Don't steal keystrokes when the user is typing in a textarea.
      const target = e.target as HTMLElement | null;
      const tag = String(target?.tagName || "").toLowerCase();
      if (tag === "textarea") return;

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      if (e.key === "Enter") {
        if (
          enabledRef.current &&
          status === "Ready" &&
          dialTo.trim().length > 0
        ) {
          e.preventDefault();
          startOutbound();
        }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        backspaceDialTo();
        return;
      }

      const allowed = "0123456789*#+";
      if (e.key && allowed.includes(e.key)) {
        e.preventDefault();
        appendToDialTo(e.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, dialTo, status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center"
        aria-label="Open dialer"
        title="Dialer"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full ${readyDotClass} absolute -top-0.5 -right-0.5 border-2 border-white`}
        />
        <Phone size={18} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      enabled ? "bg-green-400" : "bg-white/40"
                    }`}
                  />
                  <span className="text-sm font-semibold">
                    {enabled ? "Available" : "Offline"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/90">
                    {enabled
                      ? status === "Ready"
                        ? "Connected"
                        : status
                      : "Disconnected"}
                  </span>

                  {enabled && status !== "In call" && (
                    <button
                      type="button"
                      onClick={disable}
                      className="px-2 py-1 text-xs font-semibold rounded-md bg-white/15 hover:bg-white/20"
                      title="Disconnect"
                    >
                      Disconnect
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-md hover:bg-white/15"
                    aria-label="Close dialer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              {status === "Incoming" ? (
                <div>
                  <div className="text-sm text-slate-700 mb-3">
                    Incoming: {incomingFrom || "Unknown"}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={answer}
                      className="flex-1 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors bg-indigo-600 hover:bg-indigo-700"
                    >
                      Answer
                    </button>
                    <button
                      type="button"
                      onClick={reject}
                      className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Decline
                    </button>
                  </div>

                  {error && (
                    <div className="mt-3 text-sm text-red-600">{error}</div>
                  )}
                </div>
              ) : !featureEnabled ? (
                <div className="py-6">
                  <div className="text-center text-slate-700 font-semibold">
                    Web Phone is disabled
                  </div>
                  <div className="mt-2 text-center text-sm text-slate-500">
                    Ask a tenant admin to enable it in Settings → Web Phone.
                  </div>
                  {error && (
                    <div className="mt-3 text-sm text-red-600">{error}</div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                      <div className="text-slate-500 text-sm font-semibold select-none">
                        +
                      </div>
                      <input
                        autoFocus
                        type="text"
                        inputMode="tel"
                        value={dialTo}
                        onChange={(e) => setDialTo(e.target.value)}
                        placeholder="Enter a number"
                        className="flex-1 outline-none text-slate-900 placeholder:text-slate-400"
                      />

                      {dialTo.length > 0 && (
                        <button
                          type="button"
                          onClick={clearDialTo}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                          aria-label="Clear"
                          title="Clear"
                        >
                          <X size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={backspaceDialTo}
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                        aria-label="Backspace"
                        title="Backspace"
                      >
                        <Delete size={16} />
                      </button>
                    </div>

                    {status === "In call" ? (
                      <button
                        type="button"
                        onClick={hangup}
                        className="px-4 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors bg-red-600 hover:bg-red-700 inline-flex items-center gap-2"
                      >
                        <PhoneOff size={16} />
                        Hang up
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startOutbound}
                        disabled={!canCall}
                        className="px-5 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        Call
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(
                      [
                        { k: "1", sub: "" },
                        { k: "2", sub: "ABC" },
                        { k: "3", sub: "DEF" },
                        { k: "4", sub: "GHI" },
                        { k: "5", sub: "JKL" },
                        { k: "6", sub: "MNO" },
                        { k: "7", sub: "PQRS" },
                        { k: "8", sub: "TUV" },
                        { k: "9", sub: "WXYZ" },
                        { k: "*", sub: "" },
                        { k: "0", sub: "+" },
                        { k: "#", sub: "" },
                      ] as Array<{ k: string; sub: string }>
                    ).map(({ k, sub }) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => appendToDialTo(k)}
                        className="h-14 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 shadow-sm"
                      >
                        <div className="flex flex-col items-center leading-none">
                          <div className="text-xl font-bold">{k}</div>
                          {sub ? (
                            <div className="mt-1 text-[10px] tracking-widest text-slate-500 font-semibold">
                              {sub}
                            </div>
                          ) : (
                            <div className="mt-1 text-[10px] text-transparent">
                              .
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => appendToDialTo("+")}
                      className="px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      +
                    </button>

                    <div className="text-xs text-slate-400">
                      Keyboard input supported
                    </div>

                    <button
                      type="button"
                      onClick={clearDialTo}
                      className="px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  {status === "In call" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-2"
                      >
                        {muted ? <MicOff size={16} /> : <Mic size={16} />}
                        {muted ? "Unmute" : "Mute"}
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="mt-3 text-sm text-red-600">{error}</div>
                  )}

                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <div className="text-sm font-bold text-slate-800">
                      Recents
                    </div>
                    <div className="mt-2 max-h-44 overflow-auto">
                      {recents.length === 0 ? (
                        <div className="text-sm text-slate-500 py-3">
                          No recent calls yet.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {recents.slice(0, 6).map((r) => {
                            const isMissed = r.status === "missed";
                            const dirIcon =
                              r.direction === "out" ? (
                                <ArrowUpRight
                                  size={18}
                                  className={
                                    isMissed ? "text-red-600" : "text-green-600"
                                  }
                                />
                              ) : (
                                <ArrowDownLeft
                                  size={18}
                                  className={
                                    isMissed ? "text-red-600" : "text-green-600"
                                  }
                                />
                              );

                            const subtitleParts: string[] = [];
                            if (
                              r.durationSec !== undefined &&
                              r.durationSec > 0
                            ) {
                              const mins = Math.floor(r.durationSec / 60);
                              const secs = r.durationSec % 60;
                              subtitleParts.push(
                                mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
                              );
                            }
                            subtitleParts.push(formatRelativeTime(r.at));

                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setDialTo(r.number)}
                                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left"
                              >
                                <div className="shrink-0">{dirIcon}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 truncate">
                                    {r.number}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {isMissed
                                      ? "Missed"
                                      : r.status === "declined"
                                      ? "Declined"
                                      : r.status === "failed"
                                      ? "Failed"
                                      : ""}
                                    {isMissed ||
                                    r.status === "declined" ||
                                    r.status === "failed"
                                      ? " · "
                                      : ""}
                                    {subtitleParts.join(" · ")}
                                  </div>
                                </div>
                                <div className="shrink-0 text-slate-400 text-xs">
                                  Tap to dial
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WebPhoneDialer;
