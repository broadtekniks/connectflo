import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Settings,
  BookUser,
  Mic,
  MicOff,
  X,
  Delete,
  ArrowUpRight,
  ArrowDownLeft,
  PhoneForwarded,
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

const AUDIO_INPUT_STORAGE_KEY = "connectflo:webPhoneAudioInputId:v1";
const AUDIO_OUTPUT_STORAGE_KEY = "connectflo:webPhoneAudioOutputId:v1";

type AudioDeviceOption = { deviceId: string; label: string };

const parseTwilioClientIdentity = (
  identity: string
): { tenantId: string; userId: string } | null => {
  const raw = String(identity || "").trim();
  if (!raw.startsWith("tenant_")) return null;
  const rest = raw.slice("tenant_".length);
  const parts = rest.split("_user_");
  if (parts.length !== 2) return null;
  const tenantId = parts[0];
  const userId = parts[1];
  if (!tenantId || !userId) return null;
  return { tenantId, userId };
};

const parseFromAsTwilioClient = (
  fromRaw: string
): { tenantId: string; userId: string } | null => {
  const v = String(fromRaw || "").trim();
  if (!v) return null;
  const identity = v.startsWith("client:") ? v.slice("client:".length) : v;
  return parseTwilioClientIdentity(identity);
};

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

const formatCallDuration = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;
};

const WebPhoneDialer: React.FC<{ featureEnabled: boolean }> = ({
  featureEnabled,
}) => {
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<any>(null);
  const enabledRef = useRef<boolean>(false);
  const activeRecentIdRef = useRef<string | null>(null);
  const activeCallStartAtRef = useRef<number | null>(null);
  const audioSettingsRef = useRef<HTMLDivElement | null>(null);
  const audioSettingsButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<WebPhoneStatus>("Off");
  const [error, setError] = useState<string | null>(null);
  const [dialTo, setDialTo] = useState<string>("");
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [callDurationSec, setCallDurationSec] = useState<number>(0);
  const [bottomPanel, setBottomPanel] = useState<"recents" | "directory">(
    "recents"
  );
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>("");
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [myExtension, setMyExtension] = useState<string | null>(null);
  const [directoryByUserId, setDirectoryByUserId] = useState<
    Record<
      string,
      {
        extension?: string | null;
        name?: string | null;
        status?: string | null;
        lastSeen?: string | null;
      }
    >
  >({});
  const [recents, setRecents] = useState<RecentCall[]>(() =>
    safeParseRecents(window?.localStorage?.getItem(RECENTS_STORAGE_KEY) || null)
  );

  const [audioInputs, setAudioInputs] = useState<AudioDeviceOption[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<AudioDeviceOption[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string>(
    () => {
      try {
        return window.localStorage.getItem(AUDIO_INPUT_STORAGE_KEY) || "";
      } catch {
        return "";
      }
    }
  );
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string>(
    () => {
      try {
        return window.localStorage.getItem(AUDIO_OUTPUT_STORAGE_KEY) || "";
      } catch {
        return "";
      }
    }
  );

  const selectedAudioInputLabel = useMemo(() => {
    if (!selectedAudioInputId) return "System default";
    const found = audioInputs.find((d) => d.deviceId === selectedAudioInputId);
    return found?.label || "Selected microphone";
  }, [audioInputs, selectedAudioInputId]);

  const selectedAudioOutputLabel = useMemo(() => {
    if (!selectedAudioOutputId) return "System default";
    const found = audioOutputs.find(
      (d) => d.deviceId === selectedAudioOutputId
    );
    return found?.label || "Selected speaker";
  }, [audioOutputs, selectedAudioOutputId]);

  const directoryEntries = useMemo(() => {
    const rows = Object.entries(directoryByUserId)
      .map(([userId, v]) => ({
        userId,
        extension: v?.extension ? String(v.extension) : "",
        name: v?.name ? String(v.name) : "",
        status: v?.status ? String(v.status) : "",
      }))
      .filter((x) => x.extension);

    rows.sort((a, b) => {
      const an = Number(a.extension);
      const bn = Number(b.extension);
      if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
      return a.extension.localeCompare(b.extension);
    });

    return rows;
  }, [directoryByUserId]);

  useEffect(() => {
    const handler = (payload: {
      userId: string;
      tenantId: string;
      status: string;
      lastSeen: string | null;
    }) => {
      if (!payload?.userId) return;
      setDirectoryByUserId((prev) => {
        const key = String(payload.userId);
        const existing = prev[key] || {};
        return {
          ...prev,
          [key]: {
            ...existing,
            status: payload.status,
            lastSeen: payload.lastSeen,
          },
        };
      });
    };

    socketService.onExtensionPresenceUpdated(handler);
    return () => socketService.offExtensionPresenceUpdated();
  }, []);

  const supportsSpeakerSelection = useMemo(() => {
    try {
      // Speaker routing requires browser support for output device selection.
      // Firefox typically does not support this; Chromium browsers (Chrome/Edge) usually do.
      return (
        typeof (HTMLMediaElement as any)?.prototype?.setSinkId === "function" ||
        typeof (navigator as any)?.mediaDevices?.selectAudioOutput ===
          "function"
      );
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!showAudioSettings) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAudioSettings(false);
    };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const panel = audioSettingsRef.current;
      const button = audioSettingsButtonRef.current;
      if (panel?.contains(target)) return;
      if (button?.contains(target)) return;
      setShowAudioSettings(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [showAudioSettings]);

  const ensureMicrophoneAccess = async (): Promise<boolean> => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) return true;

      // If the Permissions API says we're already granted, don't re-open the mic.
      // On some Edge/Windows setups, rapid open/close can cause NotReadableError.
      try {
        const perms = (navigator as any)?.permissions;
        if (perms?.query) {
          const status = await perms.query({ name: "microphone" });
          if (status?.state === "granted") return true;
          if (status?.state === "denied") {
            setError(
              "Microphone permission is blocked in the browser. In Edge: click the lock icon → Site permissions → Microphone → Allow, then reload the page."
            );
            return false;
          }
        }
      } catch {
        // ignore (Permissions API not supported)
      }

      // Throttle repeated prompts/opens (can trip Edge into 'device busy').
      const now = Date.now();
      const last = (ensureMicrophoneAccess as any)._lastAttemptAt as
        | number
        | undefined;
      if (last && now - last < 1500) return true;
      (ensureMicrophoneAccess as any)._lastAttemptAt = now;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (e) {
      console.warn("Microphone permission error:", e);

      const err = e as any;
      const name = String(err?.name || "");
      const origin = (() => {
        try {
          return window?.location?.origin || "";
        } catch {
          return "";
        }
      })();

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError(
          "Microphone permission is blocked in the browser. In Edge: click the lock icon → Site permissions → Microphone → Allow, then reload the page."
        );
      } else if (name === "SecurityError") {
        setError(
          `Microphone access is blocked because the page isn't in a secure context. Open the app over HTTPS (or localhost). Current origin: ${origin}`
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError(
          "No microphone was found. Connect a mic/headset and try again."
        );
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError(
          "Microphone is busy or unavailable. Close other apps using the mic (Teams/Zoom/browser tabs), then try again."
        );
      } else if (name === "OverconstrainedError") {
        setError(
          "The selected microphone can't be used with the current constraints. Try switching to 'System default' microphone."
        );
      } else {
        setError(
          "Microphone permission is required to place/answer calls. Please allow microphone access and try again."
        );
      }
      return false;
    }
  };

  const refreshAudioDevices = async (requestMicPermission: boolean) => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return;
      if (requestMicPermission) {
        const ok = await ensureMicrophoneAccess();
        if (!ok) return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
        }));
      const outputs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${idx + 1}`,
        }));

      setAudioInputs(inputs);
      setAudioOutputs(outputs);

      // If a previously-saved deviceId is no longer present (common on browser/device changes),
      // clear it so we don't keep trying (and failing) to route to a non-existent device.
      if (
        selectedAudioInputId &&
        !inputs.some((d) => d.deviceId === selectedAudioInputId)
      ) {
        setSelectedAudioInputId("");
        try {
          window.localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, "");
        } catch {
          // ignore
        }
      }

      if (
        selectedAudioOutputId &&
        !outputs.some((d) => d.deviceId === selectedAudioOutputId)
      ) {
        setSelectedAudioOutputId("");
        try {
          window.localStorage.setItem(AUDIO_OUTPUT_STORAGE_KEY, "");
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn("Failed to enumerate audio devices", e);
    }
  };

  const applyTwilioAudioDevices = async (device: any) => {
    if (!device) return;

    // Input
    if (selectedAudioInputId) {
      try {
        await device?.audio?.setInputDevice?.(selectedAudioInputId);
      } catch (e) {
        console.warn("Failed to set input device", e);
      }
    }

    // Output (speaker)
    if (selectedAudioOutputId) {
      try {
        // Twilio Voice SDK supports routing to output devices where supported.
        // We set BOTH ringtone and speaker devices so incoming ringing + in-call audio
        // use the selected output on supported browsers.
        const setOutput = async (controller: any) => {
          if (!controller?.set) return;
          // Some SDK versions accept a single deviceId, others an array.
          try {
            await controller.set([selectedAudioOutputId]);
          } catch {
            await controller.set(selectedAudioOutputId);
          }
        };

        await setOutput(device?.audio?.ringtoneDevices);
        await setOutput(device?.audio?.speakerDevices);
      } catch (e) {
        console.warn("Failed to set output device", e);

        const msg =
          e && typeof e === "object" && "name" in (e as any)
            ? String((e as any).name)
            : "";
        if (msg === "NotAllowedError" || msg === "SecurityError") {
          setError(
            "Speaker selection failed. Edge/Chrome require HTTPS (or localhost) and may block output routing by policy. Try using HTTPS, then re-select the speaker."
          );
        } else {
          setError(
            "Speaker selection failed in this browser. Audio will use the system default output."
          );
        }
      }
    }
  };

  const formatCaller = (rawFrom: string): string => {
    const parsed = parseFromAsTwilioClient(rawFrom);
    if (!parsed?.userId) return rawFrom;
    const entry = directoryByUserId[parsed.userId];
    const ext = entry?.extension ? String(entry.extension) : "";
    const name = entry?.name ? String(entry.name) : "";
    if (ext && name) return `Ext. ${ext} (${name})`;
    if (ext) return `Ext. ${ext}`;
    if (name) return name;
    return rawFrom;
  };

  const dialTargetFromRecent = (raw: string): string => {
    const parsed = parseFromAsTwilioClient(raw);
    if (parsed?.userId) {
      const entry = directoryByUserId[parsed.userId];
      const ext = entry?.extension ? String(entry.extension) : "";
      if (ext) return ext;
    }
    return raw;
  };

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

  // Refresh device lists when the dialer opens.
  useEffect(() => {
    if (!isOpen) return;
    void refreshAudioDevices(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Close the menu whenever the modal closes/opens.
    setShowAudioSettings(false);
  }, [isOpen]);

  // Keep device lists in sync if hardware changes (plug/unplug).
  useEffect(() => {
    const md = navigator?.mediaDevices as any;
    if (!md?.addEventListener) return;
    const handler = () => void refreshAudioDevices(false);
    md.addEventListener("devicechange", handler);
    return () => md.removeEventListener("devicechange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user's extension number
  useEffect(() => {
    const loadExtension = async () => {
      try {
        // First try from localStorage user object
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.extension) {
            setMyExtension(user.extension);
            return;
          }
        }

        // Otherwise fetch from API
        const response = await api.get("/extensions");
        if (Array.isArray(response?.extensions)) {
          const map: Record<
            string,
            {
              extension?: string | null;
              name?: string | null;
              status?: string | null;
              lastSeen?: string | null;
            }
          > = {};
          for (const e of response.extensions) {
            if (!e?.userId) continue;
            map[String(e.userId)] = {
              extension: e.extension ?? null,
              name: e.name ?? null,
              status: e.status ?? null,
              lastSeen: e.lastSeen ?? null,
            };
          }
          setDirectoryByUserId(map);
        }
        const user = JSON.parse(userStr || "{}");
        const myExt = response.extensions?.find(
          (e: any) => e.userId === user.id
        );
        if (myExt?.extension) {
          setMyExtension(myExt.extension);
        }
      } catch (error) {
        console.error("Failed to load extension:", error);
      }
    };

    loadExtension();
  }, []);

  const setSocketReady = (ready: boolean) => {
    try {
      socketService.setWebPhoneReady(ready);
    } catch {
      // ignore
    }
  };

  const updatePresence = async (status: "ONLINE" | "OFFLINE" | "BUSY") => {
    try {
      // Check if user is still authenticated
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No auth token, skipping presence update");
        return;
      }

      console.log("Updating presence to:", status);
      await api.post("/extensions/presence", { status });
      console.log("Presence updated successfully");
    } catch (error) {
      console.error("Failed to update presence:", error);
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
    // Check if user is authenticated
    const authToken = localStorage.getItem("token");
    if (!authToken) {
      setStatus("Error");
      setError("Please log in to use the web phone.");
      setIsOpen(true);
      return;
    }

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
        updatePresence("ONLINE");
      });

      device.on("unregistered", () => {
        setSocketReady(false);
        setStatus("Off");
        updatePresence("OFFLINE");
      });

      device.on("error", (e: any) => {
        setSocketReady(false);
        setStatus("Error");
        setError(String(e?.message || "Web phone error"));
        updatePresence("OFFLINE");
      });

      device.on("incoming", (call: any) => {
        activeCallRef.current = call;
        const from = String(call?.parameters?.From || "Unknown");
        setIncomingFrom(from);
        setStatus("Incoming");
        setIsOpen(true);
        updatePresence("BUSY");

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

        call.on?.("accept", () => {
          setStatus("In call");
          activeCallStartAtRef.current = Date.now();
        });

        call.on?.("error", (e: any) => {
          console.error("[WebPhone] Incoming call error:", e);
          setError(String(e?.message || "Call error"));
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
          updatePresence(enabledRef.current ? "ONLINE" : "OFFLINE");

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

      await applyTwilioAudioDevices(device as any);

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

  // Apply new selections to an already-registered device.
  useEffect(() => {
    if (!enabled) return;
    const device = deviceRef.current as any;
    if (!device) return;
    void applyTwilioAudioDevices(device);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selectedAudioInputId, selectedAudioOutputId]);

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
      const ok = await ensureMicrophoneAccess();
      if (!ok) return;
      call.accept();
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

  const initiateTransfer = () => {
    setShowTransferModal(true);
    setTransferTarget("");
  };

  const executeTransfer = async () => {
    if (!transferTarget.trim()) return;

    try {
      setError(null);

      // Call backend to initiate blind transfer
      await api.post("/api/twilio/transfer", {
        callSid: activeCallRef.current?.parameters?.CallSid,
        transferTo: transferTarget.trim(),
      });

      // After initiating transfer, hangup current connection
      hangup();
      setShowTransferModal(false);
    } catch (err: any) {
      setError(err.message || "Transfer failed");
    }
  };

  const startOutbound = async () => {
    const device = deviceRef.current;
    if (!device) return;

    try {
      setError(null);
      const ok = await ensureMicrophoneAccess();
      if (!ok) return;

      // Ensure the latest selection is applied before starting a call.
      await applyTwilioAudioDevices(device as any);

      const number = dialTo.trim();
      const recentId = addRecent({
        direction: "out",
        number,
        status: "dialing",
        at: Date.now(),
      });
      activeRecentIdRef.current = recentId;
      activeCallStartAtRef.current = null;

      const call = await (device as any).connect({
        params: { To: number },
      });
      activeCallRef.current = call;
      setStatus("In call");
      updatePresence("BUSY");

      call.on?.("accept", () => {
        if (!activeCallStartAtRef.current) {
          activeCallStartAtRef.current = Date.now();
        }
      });

      call.on?.("error", (e: any) => {
        console.error("[WebPhone] Outbound call error:", e);
        setError(String(e?.message || "Call error"));
      });

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
        updatePresence(enabledRef.current ? "ONLINE" : "OFFLINE");

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
    if (status !== "In call") {
      setCallDurationSec(0);
      return;
    }

    const tick = () => {
      const started = activeCallStartAtRef.current;
      if (!started) {
        setCallDurationSec(0);
        return;
      }
      setCallDurationSec(
        Math.max(0, Math.floor((Date.now() - started) / 1000))
      );
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status]);

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
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white relative">
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
                  {myExtension && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                      Ext. {myExtension}
                    </span>
                  )}

                  {status === "In call" && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                      {formatCallDuration(callDurationSec)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {featureEnabled && (
                    <button
                      type="button"
                      onClick={enabled ? disable : enable}
                      disabled={
                        status === "Connecting" ||
                        status === "Incoming" ||
                        status === "In call"
                      }
                      className="px-2 py-1 text-xs font-semibold rounded-md bg-white/15 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                      title={enabled ? "Disconnect" : "Connect"}
                    >
                      {enabled ? <PhoneOff size={14} /> : <Phone size={14} />}
                      {enabled ? "Disconnect" : "Connect"}
                    </button>
                  )}

                  <button
                    ref={audioSettingsButtonRef}
                    type="button"
                    onClick={() => {
                      setShowAudioSettings((v) => !v);
                      void refreshAudioDevices(false);
                    }}
                    className="p-2 rounded-md bg-white/15 hover:bg-white/20 inline-flex items-center justify-center"
                    title={`Audio settings (Mic: ${selectedAudioInputLabel}, Speaker: ${selectedAudioOutputLabel})`}
                    aria-label="Audio settings"
                  >
                    <Settings size={16} />
                  </button>

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

              {showAudioSettings && (
                <div
                  ref={audioSettingsRef}
                  className="absolute right-3 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white text-slate-900 rounded-xl border border-slate-200 shadow-lg ring-1 ring-black/5 z-10 overflow-hidden"
                  role="dialog"
                  aria-label="Audio settings"
                >
                  <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-800">
                      Audio
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAudioSettings(false)}
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                      aria-label="Close audio settings"
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="p-3 grid grid-cols-1 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase">
                          Microphone
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await ensureMicrophoneAccess();
                            if (!ok) return;
                            await refreshAudioDevices(false);
                          }}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                        >
                          Allow access
                        </button>
                      </div>
                      <select
                        value={selectedAudioInputId}
                        onChange={(e) => {
                          const next = String(e.target.value || "");
                          setSelectedAudioInputId(next);
                          try {
                            window.localStorage.setItem(
                              AUDIO_INPUT_STORAGE_KEY,
                              next
                            );
                          } catch {
                            // ignore
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">System default</option>
                        {audioInputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs text-slate-500">
                        Current: {selectedAudioInputLabel}
                        {audioInputs.length === 0
                          ? " · Allow access to show device names."
                          : ""}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Speaker
                      </label>
                      <select
                        value={selectedAudioOutputId}
                        onChange={(e) => {
                          const next = String(e.target.value || "");
                          setSelectedAudioOutputId(next);
                          try {
                            window.localStorage.setItem(
                              AUDIO_OUTPUT_STORAGE_KEY,
                              next
                            );
                          } catch {
                            // ignore
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        disabled={
                          !supportsSpeakerSelection || audioOutputs.length === 0
                        }
                      >
                        <option value="">System default</option>
                        {audioOutputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs text-slate-500">
                        Current: {selectedAudioOutputLabel}
                        {!supportsSpeakerSelection
                          ? " · This browser cannot route call audio to a selected speaker (uses system default)."
                          : audioOutputs.length === 0
                          ? " · Output selection may be unsupported in this browser."
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4">
              {status === "Incoming" ? (
                <div>
                  <div className="text-sm text-slate-700 mb-3">
                    Incoming: {formatCaller(incomingFrom || "Unknown")}
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
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                      >
                        {muted ? <MicOff size={16} /> : <Mic size={16} />}
                        {muted ? "Unmute" : "Mute"}
                      </button>
                      <button
                        type="button"
                        onClick={initiateTransfer}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <PhoneForwarded size={16} />
                        Transfer
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="mt-3 text-sm text-red-600">{error}</div>
                  )}

                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setBottomPanel("recents")}
                          className={`px-3 py-1.5 text-xs font-semibold ${
                            bottomPanel === "recents"
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Recents
                        </button>
                        <button
                          type="button"
                          onClick={() => setBottomPanel("directory")}
                          className={`px-3 py-1.5 text-xs font-semibold ${
                            bottomPanel === "directory"
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <BookUser size={14} />
                            Directory
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 max-h-44 overflow-auto">
                      {bottomPanel === "recents" ? (
                        recents.length === 0 ? (
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
                                      isMissed
                                        ? "text-red-600"
                                        : "text-green-600"
                                    }
                                  />
                                ) : (
                                  <ArrowDownLeft
                                    size={18}
                                    className={
                                      isMissed
                                        ? "text-red-600"
                                        : "text-green-600"
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
                                  onClick={() =>
                                    setDialTo(dialTargetFromRecent(r.number))
                                  }
                                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left"
                                >
                                  <div className="shrink-0">{dirIcon}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 truncate">
                                      {formatCaller(r.number)}
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
                        )
                      ) : directoryEntries.length === 0 ? (
                        <div className="text-sm text-slate-500 py-3">
                          No extensions found.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {directoryEntries.slice(0, 25).map((e) =>
                            (() => {
                              const s = String(e.status || "").toUpperCase();
                              const dotClass =
                                s === "ONLINE"
                                  ? "bg-green-500"
                                  : s === "BUSY"
                                  ? "bg-amber-500"
                                  : "bg-slate-300";
                              const statusLabel =
                                s === "ONLINE"
                                  ? "Online"
                                  : s === "BUSY"
                                  ? "Busy"
                                  : "Offline";

                              return (
                                <button
                                  key={e.userId}
                                  type="button"
                                  onClick={() => setDialTo(e.extension)}
                                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left"
                                >
                                  <div className="shrink-0">
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full ${dotClass}`}
                                      aria-label={statusLabel}
                                      title={statusLabel}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 truncate">
                                      Ext. {e.extension}
                                      {e.name ? ` (${e.name})` : ""}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {statusLabel} · Tap to dial
                                    </div>
                                  </div>
                                </button>
                              );
                            })()
                          )}
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

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90%]">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Transfer Call
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Transfer to Extension or Phone Number
              </label>
              <input
                type="text"
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                placeholder="e.g., 101 or +15551234567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter 3-4 digit extension (e.g., 101) or full phone number
              </p>
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setError(null);
                }}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeTransfer}
                disabled={!transferTarget.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WebPhoneDialer;
