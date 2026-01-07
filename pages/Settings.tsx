import React, { useState, useEffect } from "react";
import {
  User,
  Users,
  Bell,
  Shield,
  Globe,
  Building,
  Clock,
  Phone,
  Bot,
  Save,
  Upload,
  Mic,
  Palette,
  Volume2,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Code,
  Copy,
  Terminal,
  LayoutTemplate,
  MessageSquare,
  Edit,
  PackageOpen,
  Target,
  Tag,
  Lock,
  Mail,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { User as UserType, Plan } from "../types";
import { api } from "../services/api";
import { socketService } from "../services/socket";
import TestChatWidget from "../components/TestChatWidget";
import PhoneVoiceSettings from "../components/PhoneVoiceSettings";
import AlertModal from "../components/AlertModal";
import ConfirmationModal from "../components/ConfirmationModal";
import WorkingHoursModal, {
  WorkingHoursConfig,
} from "../components/WorkingHoursModal";
import PhoneVerification from "../components/PhoneVerification";
import TOTPSetup from "../components/TOTPSetup";

const getDetectedTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const getTimeZoneOptions = (preferred?: string): string[] => {
  const intlAny: any = Intl as any;
  if (typeof intlAny.supportedValuesOf === "function") {
    try {
      const zones = intlAny.supportedValuesOf("timeZone");
      if (Array.isArray(zones) && zones.length > 0) {
        if (preferred && !zones.includes(preferred)) {
          return [preferred, ...zones];
        }
        return zones;
      }
    } catch {
      // fall through
    }
  }

  // Fallback list for older runtimes
  const fallback = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/Madrid",
    "Africa/Lagos",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];

  if (preferred && !fallback.includes(preferred)) {
    return [preferred, ...fallback];
  }

  return fallback;
};

const formatUtcOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
};

const getTimeZoneOffsetMinutes = (timeZone: string, at: Date): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return Math.round((asUtc - at.getTime()) / 60000);
};

const formatTimeZoneLabel = (timeZone: string): string => {
  try {
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, new Date());
    return `${timeZone} (${formatUtcOffset(offsetMinutes)})`;
  } catch {
    return timeZone;
  }
};

// Intent Management Component
const IntentManagement: React.FC = () => {
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIntent, setEditingIntent] = useState<any | null>(null);
  const [editingKeywordsText, setEditingKeywordsText] = useState("");
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });
  const [intentIdToDelete, setIntentIdToDelete] = useState<string | null>(null);
  const [showDeleteIntentModal, setShowDeleteIntentModal] = useState(false);

  useEffect(() => {
    loadIntents();
  }, []);

  const keywordsToText = (keywords: any): string => {
    if (!Array.isArray(keywords)) return "";
    return keywords.join(", ");
  };

  const parseKeywords = (raw: string): string[] => {
    const parts = raw
      .split(/[\n,;]+/g)
      .map((k) => k.trim())
      .filter(Boolean);

    // De-dupe while preserving order
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const p of parts) {
      const key = p.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(p);
    }
    return unique;
  };

  const normalizeIntentKeywords = (intent: any): any => {
    const keywords = Array.isArray(intent?.keywords) ? intent.keywords : [];
    return { ...intent, keywords };
  };

  const startEditingIntent = (intent: any) => {
    setEditingIntent(intent);
    setEditingKeywordsText(keywordsToText(intent?.keywords));
  };

  const loadIntents = async () => {
    try {
      const response = await api.get("/ai-config/intents");
      setIntents(response.intents || []);
    } catch (error) {
      console.error("Failed to load intents:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveIntents = async () => {
    setSaving(true);
    try {
      const intentsToSave = intents
        .map(normalizeIntentKeywords)
        .map((intent) => {
          if (editingIntent?.id && intent.id === editingIntent.id) {
            return {
              ...intent,
              keywords: parseKeywords(editingKeywordsText),
            };
          }
          return intent;
        });

      await api.put("/ai-config/intents", { intents: intentsToSave });
      setIntents(intentsToSave);
      if (editingIntent) {
        setEditingIntent(null);
        setEditingKeywordsText("");
      }
      setAlertModal({
        isOpen: true,
        title: "Saved",
        message: "Intents saved successfully.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to save intents:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save intents. Please try again.";
      setAlertModal({
        isOpen: true,
        title: "Save failed",
        message,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const addIntent = () => {
    const newIntent = {
      id: `custom_${Date.now()}`,
      name: "New Intent",
      description: "Describe what this intent detects",
      keywords: [],
      enabled: true,
    };
    setIntents([...intents, newIntent]);
    startEditingIntent(newIntent);
  };

  const updateIntent = (id: string, updates: Partial<any>) => {
    setIntents(
      intents.map((intent) =>
        intent.id === id ? { ...intent, ...updates } : intent
      )
    );
  };

  const deleteIntent = (id: string) => {
    setIntentIdToDelete(id);
    setShowDeleteIntentModal(true);
  };

  const handleConfirmDeleteIntent = () => {
    if (!intentIdToDelete) return;

    setIntents(intents.filter((intent) => intent.id !== intentIdToDelete));
    setShowDeleteIntentModal(false);
    setIntentIdToDelete(null);
  };

  const handleCancelDeleteIntent = () => {
    setShowDeleteIntentModal(false);
    setIntentIdToDelete(null);
  };

  const toggleIntent = (id: string) => {
    setIntents(
      intents.map((intent) =>
        intent.id === id ? { ...intent, enabled: !intent.enabled } : intent
      )
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="text-center py-8 text-slate-500">
          Loading intents...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Target size={18} className="text-indigo-500" /> Intent Detection
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure which customer intents the AI should detect and respond to
          </p>
        </div>
        <button
          onClick={addIntent}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium"
        >
          <Plus size={16} /> Add Intent
        </button>
      </div>

      <div className="space-y-3">
        {intents.map((intent) => (
          <div
            key={intent.id}
            className={`border rounded-lg p-4 transition-all ${
              intent.enabled
                ? "border-slate-200 bg-white"
                : "border-slate-100 bg-slate-50 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <button
                  onClick={() => toggleIntent(intent.id)}
                  className={`mt-1 w-10 h-5 rounded-full transition-colors relative ${
                    intent.enabled ? "bg-green-500" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                      intent.enabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>

                {editingIntent?.id === intent.id ? (
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={intent.name}
                      onChange={(e) =>
                        updateIntent(intent.id, { name: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium"
                      placeholder="Intent name"
                    />
                    <textarea
                      value={intent.description}
                      onChange={(e) =>
                        updateIntent(intent.id, { description: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      placeholder="Description"
                      rows={2}
                    />
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Keywords (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={editingKeywordsText}
                        onChange={(e) => setEditingKeywordsText(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                        placeholder="e.g. hello, hi, hey, greetings"
                      />
                    </div>
                    <button
                      onClick={() => {
                        updateIntent(intent.id, {
                          keywords: parseKeywords(editingKeywordsText),
                        });
                        setEditingIntent(null);
                        setEditingKeywordsText("");
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Done Editing
                    </button>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-800">
                        {intent.name}
                      </h4>
                      {!intent.enabled && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-600 rounded">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {intent.description}
                    </p>
                    {intent.keywords && intent.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {intent.keywords
                          .slice(0, 5)
                          .map((keyword: string, i: number) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium"
                            >
                              {keyword}
                            </span>
                          ))}
                        {intent.keywords.length > 5 && (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                            +{intent.keywords.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEditingIntent(intent)}
                  className="text-slate-400 hover:text-indigo-600"
                  title="Edit"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => deleteIntent(intent.id)}
                  className="text-slate-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
        <button
          onClick={saveIntents}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "Saving..." : "Save Intents"}
        </button>
      </div>

      <ConfirmationModal
        isOpen={showDeleteIntentModal}
        title="Delete intent?"
        message="This will remove the intent from this tenant's configuration."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive
        onConfirm={handleConfirmDeleteIntent}
        onCancel={handleCancelDeleteIntent}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState("general");
  const [user, setUser] = useState<UserType | null>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [detectedTimeZone] = useState(() => getDetectedTimeZone());
  const [timeZoneOptions] = useState(() =>
    getTimeZoneOptions(detectedTimeZone)
  );
  const [timeZone, setTimeZone] = useState<string>(detectedTimeZone);
  const [timeZoneSaving, setTimeZoneSaving] = useState(false);
  const [callerIdNumbers, setCallerIdNumbers] = useState<
    Array<{ id: string; number: string; friendlyName: string }>
  >([]);
  const [callerIdSelection, setCallerIdSelection] = useState<string>("");
  const [callerIdSaving, setCallerIdSaving] = useState(false);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [myAgentTimeZone, setMyAgentTimeZone] = useState<string | null>(null);
  const [myWorkingHours, setMyWorkingHours] = useState<null | Record<
    string,
    { start: string; end: string } | null
  >>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [tenantScheduleTimeZone, setTenantScheduleTimeZone] = useState<
    string | null
  >(null);

  const defaultBusinessHours = {
    days: {
      mon: { enabled: true, start: "09:00", end: "17:00" },
      tue: { enabled: true, start: "09:00", end: "17:00" },
      wed: { enabled: true, start: "09:00", end: "17:00" },
      thu: { enabled: true, start: "09:00", end: "17:00" },
      fri: { enabled: true, start: "09:00", end: "17:00" },
      sat: { enabled: false, start: "09:00", end: "17:00" },
      sun: { enabled: false, start: "09:00", end: "17:00" },
    },
  };

  const [businessTimeZone, setBusinessTimeZone] =
    useState<string>(detectedTimeZone);
  const [businessHours, setBusinessHours] = useState<any>(defaultBusinessHours);
  const [calendarAutoAddMeet, setCalendarAutoAddMeet] = useState<boolean>(true);
  const [maxMeetingDurationMinutes, setMaxMeetingDurationMinutes] =
    useState<number>(60);
  const [chatAfterHoursMode, setChatAfterHoursMode] = useState<
    "ONLY_ON_ESCALATION" | "ALWAYS" | "NEVER"
  >("ONLY_ON_ESCALATION");
  const [chatAfterHoursMessage, setChatAfterHoursMessage] =
    useState<string>("");
  const [businessHoursLoading, setBusinessHoursLoading] = useState(false);
  const [businessHoursSaving, setBusinessHoursSaving] = useState(false);
  const [webPhoneEnabled, setWebPhoneEnabled] = useState<boolean>(false);
  const [webPhoneOutboundCallerNumber, setWebPhoneOutboundCallerNumber] =
    useState<string>("");
  const [webPhoneOutboundCallerName, setWebPhoneOutboundCallerName] =
    useState<string>("");
  const [webPhoneLoading, setWebPhoneLoading] = useState(false);
  const [webPhoneSaving, setWebPhoneSaving] = useState(false);

  // Extensions state
  const [extensions, setExtensions] = useState<
    Array<{
      userId: string;
      name: string;
      email: string;
      extension: string;
      label: string | null;
      status: string;
    }>
  >([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
    }>
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [assignExtension, setAssignExtension] = useState<string>("");
  const [assignExtensionLabel, setAssignExtensionLabel] = useState<string>("");
  const [extensionSaving, setExtensionSaving] = useState(false);

  // Security state
  const [securityStatus, setSecurityStatus] = useState<{
    emailVerified: boolean;
    phoneVerified: boolean;
    mfaEnabled: boolean;
    isGoogleUser: boolean;
  }>({
    emailVerified: false,
    phoneVerified: false,
    mfaEnabled: false,
    isGoogleUser: false,
  });
  const [securityLoading, setSecurityLoading] = useState(true);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [showTOTPSetup, setShowTOTPSetup] = useState(false);
  const [googleAuthLinking, setGoogleAuthLinking] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);

      // If the local user object already has a timezone, prefer it while we fetch.
      if (userData?.timeZone) {
        setTimeZone(String(userData.timeZone));
      }

      if (userData.tenantId) {
        api.tenants.get(userData.tenantId).then(setTenant).catch(console.error);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    api.me
      .getProfile()
      .then((profile) => {
        const tz = profile?.timeZone || detectedTimeZone;
        setTimeZone(tz);
      })
      .catch((error) => {
        console.error("Failed to load profile", error);
        setTimeZone((prev) => prev || detectedTimeZone);
      });
  }, [user?.id, detectedTimeZone]);

  useEffect(() => {
    if (!user?.tenantId) return;
    if (user.role !== "TENANT_ADMIN" && user.role !== "AGENT") return;

    api.tenants
      .getBusinessTimeZone()
      .then((tz) => setTenantScheduleTimeZone(tz.timeZone ?? null))
      .catch(() => setTenantScheduleTimeZone(null));

    setScheduleLoading(true);
    api.me
      .getSchedule()
      .then((data) => {
        setMyAgentTimeZone(data.agentTimeZone ?? null);
        setMyWorkingHours((data as any)?.workingHours ?? null);
      })
      .catch((e) => {
        console.error("Failed to load schedule", e);
      })
      .finally(() => setScheduleLoading(false));
  }, [user?.tenantId, user?.role]);

  const summarizeWorkingHours = (
    workingHours?: typeof myWorkingHours
  ): string => {
    if (!workingHours || typeof workingHours !== "object") {
      return "Tenant default";
    }
    const enabledDays = Object.values(workingHours).filter(
      (v) => v && (v as any).start && (v as any).end
    );
    if (enabledDays.length === 0) return "Closed";
    if (enabledDays.length === 7) return "Daily";
    return `${enabledDays.length} days`;
  };

  useEffect(() => {
    if (!user?.tenantId) return;
    if (user.role !== "TENANT_ADMIN" && user.role !== "AGENT") return;

    Promise.allSettled([api.phoneNumbers.list(), api.me.getCallerId()]).then(
      (results) => {
        const numbersRes = results[0];
        const prefRes = results[1];

        if (numbersRes.status === "fulfilled") {
          setCallerIdNumbers(
            numbersRes.value.map((n) => ({
              id: n.id,
              number: n.number,
              friendlyName: n.friendlyName,
            }))
          );
        }

        if (prefRes.status === "fulfilled") {
          setCallerIdSelection(prefRes.value.phoneNumberId || "");
        }
      }
    );
  }, [user?.tenantId, user?.role]);

  useEffect(() => {
    if (!user?.tenantId) return;
    if (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN") return;

    setBusinessHoursLoading(true);
    api.tenants
      .getBusinessHours()
      .then((data) => {
        if (data?.timeZone) setBusinessTimeZone(String(data.timeZone));
        if (data?.businessHours) setBusinessHours(data.businessHours);
        if (typeof (data as any)?.calendarAutoAddMeet === "boolean") {
          setCalendarAutoAddMeet(Boolean((data as any).calendarAutoAddMeet));
        }
        if (typeof (data as any)?.maxMeetingDurationMinutes === "number") {
          const v = (data as any).maxMeetingDurationMinutes;
          if (Number.isFinite(v) && v > 0) {
            setMaxMeetingDurationMinutes(Math.floor(v));
          }
        }
        if (data?.chatAfterHoursMode)
          setChatAfterHoursMode(data.chatAfterHoursMode);
        setChatAfterHoursMessage(String(data?.chatAfterHoursMessage || ""));
      })
      .catch((err) => {
        console.error("Failed to load business hours", err);
      })
      .finally(() => setBusinessHoursLoading(false));
  }, [user?.tenantId, user?.role]);

  useEffect(() => {
    if (!user?.tenantId) return;
    if (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN") return;

    setWebPhoneLoading(true);
    api.tenants
      .getWebPhoneSettings()
      .then((data) => {
        setWebPhoneEnabled(Boolean(data?.webPhoneEnabled));
        setWebPhoneOutboundCallerNumber(
          String(data?.webPhoneOutboundCallerNumber || "")
        );
        setWebPhoneOutboundCallerName(
          String(data?.webPhoneOutboundCallerName || "")
        );
      })
      .catch((err) => {
        console.error("Failed to load web phone settings", err);
        setWebPhoneEnabled(false);
        setWebPhoneOutboundCallerNumber("");
        setWebPhoneOutboundCallerName("");
      })
      .finally(() => setWebPhoneLoading(false));
  }, [user?.tenantId, user?.role]);

  // Load extensions and team members
  useEffect(() => {
    if (!user) return;

    setExtensionsLoading(true);

    // Load extensions
    api
      .get("/extensions")
      .then((data: any) => {
        setExtensions(data.extensions || []);
      })
      .catch((err) => {
        console.error("Failed to load extensions", err);
      })
      .finally(() => setExtensionsLoading(false));

    // Load team members
    api
      .get("/team-members")
      .then((data: any) => {
        // API returns array directly, not wrapped in object
        const members = Array.isArray(data) ? data : [];
        setTeamMembers(
          members.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to load team members", err);
      });

    // Subscribe to real-time extension presence updates
    socketService.connect();
    const handlePresenceUpdate = (payload: {
      userId: string;
      tenantId: string;
      status: string;
      lastSeen: string | null;
    }) => {
      console.log("Extension presence update received:", payload);
      setExtensions((prev) =>
        prev.map((ext) =>
          ext.userId === payload.userId
            ? { ...ext, status: payload.status }
            : ext
        )
      );
    };

    socketService.onExtensionPresenceUpdated(handlePresenceUpdate);

    return () => {
      socketService.offExtensionPresenceUpdated();
    };
  }, [user]);

  // Load security status
  useEffect(() => {
    if (!user) return;

    setSecurityLoading(true);
    api.me
      .getProfile()
      .then((profile: any) => {
        setSecurityStatus({
          emailVerified: Boolean(profile.emailVerified),
          phoneVerified: Boolean(profile.phoneVerified),
          mfaEnabled: Boolean(profile.mfaEnabled),
          isGoogleUser: Boolean(profile.googleId), // User has googleId means they signed up with Google
        });
      })
      .catch((error) => {
        console.error("Failed to load security status:", error);
      })
      .finally(() => {
        setSecurityLoading(false);
      });
  }, [user?.id]);

  const handleToggleWebPhoneEnabled = async (next: boolean) => {
    if (!user?.tenantId) return;
    if (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN") return;

    setWebPhoneSaving(true);
    try {
      const updated = await api.tenants.setWebPhoneSettings({
        webPhoneEnabled: next,
      });
      setWebPhoneEnabled(Boolean(updated?.webPhoneEnabled));
      setSettingsAlertModal({
        isOpen: true,
        title: "Saved",
        message: "Web Phone setting updated.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to update web phone settings", error);
      setSettingsAlertModal({
        isOpen: true,
        title: "Save failed",
        message: "Failed to update Web Phone setting.",
        type: "error",
      });
    } finally {
      setWebPhoneSaving(false);
    }
  };

  const handleSaveWebPhoneOutboundSettings = async () => {
    if (!user?.tenantId) return;
    if (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN") return;

    setWebPhoneSaving(true);
    try {
      const updated = await api.tenants.setWebPhoneSettings({
        webPhoneOutboundCallerNumber: webPhoneOutboundCallerNumber
          ? webPhoneOutboundCallerNumber
          : null,
        webPhoneOutboundCallerName: webPhoneOutboundCallerName
          ? webPhoneOutboundCallerName
          : null,
      });
      setWebPhoneOutboundCallerNumber(
        String(updated?.webPhoneOutboundCallerNumber || "")
      );
      setWebPhoneOutboundCallerName(
        String(updated?.webPhoneOutboundCallerName || "")
      );
      setSettingsAlertModal({
        isOpen: true,
        title: "Saved",
        message: "Web Phone outbound settings updated.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to update web phone outbound settings", error);
      setSettingsAlertModal({
        isOpen: true,
        title: "Save failed",
        message: "Failed to update Web Phone outbound settings.",
        type: "error",
      });
    } finally {
      setWebPhoneSaving(false);
    }
  };

  const handleAssignExtension = async () => {
    if (!selectedUserId || !assignExtension) return;

    setExtensionSaving(true);
    try {
      await api.post("/extensions/assign", {
        userId: selectedUserId,
        extension: assignExtension.trim(),
        label: assignExtensionLabel.trim() || undefined,
      });

      setSettingsAlertModal({
        isOpen: true,
        title: "Saved",
        message: "Extension assigned successfully.",
        type: "success",
      });

      // Reset form and reload extensions
      setSelectedUserId("");
      setAssignExtension("");
      setAssignExtensionLabel("");

      const data: any = await api.get("/extensions");
      setExtensions(data.extensions || []);
    } catch (error: any) {
      console.error("Failed to save extension", error);
      setSettingsAlertModal({
        isOpen: true,
        title: "Save failed",
        message: error.message || "Failed to save extension.",
        type: "error",
      });
    } finally {
      setExtensionSaving(false);
    }
  };

  const handleRemoveExtension = async (userId: string) => {
    setExtensionSaving(true);
    try {
      await api.delete(`/extensions/${userId}`);

      setSettingsAlertModal({
        isOpen: true,
        title: "Removed",
        message: "Extension removed successfully.",
        type: "success",
      });

      // Reload extensions
      const data: any = await api.get("/extensions");
      setExtensions(data.extensions || []);
    } catch (error: any) {
      console.error("Failed to remove extension", error);
      setSettingsAlertModal({
        isOpen: true,
        title: "Remove failed",
        message: error.message || "Failed to remove extension.",
        type: "error",
      });
    } finally {
      setExtensionSaving(false);
    }
  };

  // When a team member is selected, pre-fill their current extension if any
  const handleTeamMemberSelect = (userId: string) => {
    setSelectedUserId(userId);
    const existingExt = extensions.find((e) => e.userId === userId);
    if (existingExt) {
      setAssignExtension(existingExt.extension || "");
      setAssignExtensionLabel(existingExt.label || "");
    } else {
      setAssignExtension("");
      setAssignExtensionLabel("");
    }
  };

  const handleSaveBusinessHours = async () => {
    if (!user?.tenantId) return;
    if (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN") return;

    setBusinessHoursSaving(true);
    try {
      await api.tenants.setBusinessHours({
        timeZone: businessTimeZone || null,
        businessHours,
        calendarAutoAddMeet,
        maxMeetingDurationMinutes,
        chatAfterHoursMode,
        chatAfterHoursMessage: chatAfterHoursMessage.trim() || null,
      });
      setSettingsAlertModal({
        isOpen: true,
        title: "Saved",
        message: "Business hours updated successfully.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to save business hours", error);
      setSettingsAlertModal({
        isOpen: true,
        title: "Save failed",
        message: "Failed to update business hours.",
        type: "error",
      });
    } finally {
      setBusinessHoursSaving(false);
    }
  };

  // Security handlers
  const handlePhoneVerificationComplete = async () => {
    setShowPhoneVerification(false);
    // Refresh security status
    try {
      const profile: any = await api.me.getProfile();
      setSecurityStatus({
        emailVerified: Boolean(profile.emailVerified),
        phoneVerified: Boolean(profile.phoneVerified),
        mfaEnabled: Boolean(profile.mfaEnabled),
        isGoogleUser: Boolean(profile.googleId),
      });
      setSettingsAlertModal({
        isOpen: true,
        title: "Success",
        message: "Phone verification completed successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to refresh security status:", error);
    }
  };

  const handleTOTPSetupComplete = async () => {
    setShowTOTPSetup(false);
    // Refresh security status
    try {
      const profile: any = await api.me.getProfile();
      setSecurityStatus({
        emailVerified: Boolean(profile.emailVerified),
        phoneVerified: Boolean(profile.phoneVerified),
        mfaEnabled: Boolean(profile.mfaEnabled),
        isGoogleUser: Boolean(profile.googleId),
      });
      setSettingsAlertModal({
        isOpen: true,
        title: "Success",
        message: "Two-factor authentication enabled successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to refresh security status:", error);
    }
  };

  const handleLinkGoogleAccount = async () => {
    setGoogleAuthLinking(true);
    try {
      // Get Google OAuth URL from backend
      const response = await api.post("/auth/link-google");
      if (response.authUrl) {
        // Redirect to Google OAuth
        window.location.href = response.authUrl;
      }
    } catch (error) {
      console.error("Failed to link Google account:", error);
      setSettingsAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to link Google account. Please try again.",
        type: "error",
      });
      setGoogleAuthLinking(false);
    }
  };

  const getSecurityLevel = (): number => {
    if (!securityStatus.emailVerified) return 0;
    if (!securityStatus.phoneVerified) return 1;
    if (!securityStatus.mfaEnabled) return 2;
    return 3;
  };

  // AI Config State
  const [aiName, setAiName] = useState("Flo");
  const [toneOfVoice, setToneOfVoice] = useState("Friendly & Casual");
  const [businessDescription, setBusinessDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are Flo, a helpful and friendly customer support assistant for ConnectFlo. You answer questions concisely and escalate to a human if the customer seems angry."
  );
  const [handoffThreshold, setHandoffThreshold] = useState(0.7);
  const [autoEscalate, setAutoEscalate] = useState(true);
  const [saving, setSaving] = useState(false);

  // Plans State (Super Admin only)
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [showDeletePlanModal, setShowDeletePlanModal] = useState(false);
  const [settingsAlertModal, setSettingsAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({ isOpen: false, title: "", message: "", type: "info" });
  const [planFormData, setPlanFormData] = useState({
    name: "",
    documentLimit: 5,
    docSizeLimitMB: 10,
    pricingDiscount: 0,
    fallbackMarkup: 0.5,
  });

  useEffect(() => {
    if (user?.tenantId) {
      api.aiConfig
        .get()
        .then((config) => {
          setAiName(config.name);
          setToneOfVoice(config.toneOfVoice || "Friendly & Casual");
          setBusinessDescription(config.businessDescription || "");
          setSystemPrompt(config.systemPrompt);
          setHandoffThreshold(config.handoffThreshold);
          setAutoEscalate(config.autoEscalate);
        })
        .catch(console.error);
    }
  }, [user?.tenantId]);

  // Load plans for super admin
  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      api.plans.list().then(setPlans).catch(console.error);
    }
  }, [user?.role]);

  const handleSaveAiConfig = async () => {
    if (!user?.tenantId) return;
    setSaving(true);
    try {
      await api.aiConfig.update({
        name: aiName,
        toneOfVoice,
        businessDescription,
        systemPrompt,
        handoffThreshold,
        autoEscalate,
      });
      // Show success toast or message (optional)
    } catch (error) {
      console.error("Failed to save AI config", error);
    } finally {
      setSaving(false);
    }
  };

  // Installation State
  const [copied, setCopied] = useState(false);

  const embedCode = `<!-- ConnectFlo Widget -->
<script>
  window.ConnectFloSettings = {
    app_id: "cf_live_x923kds92",
    alignment: "right",
    theme_color: "#4f46e5"
  };
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "https://cdn.connectflo.ai/widget/v1/bundle.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'connectflo-js'));
</script>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePlan = async () => {
    try {
      if (editingPlan) {
        // Update existing plan
        await api.plans.update(editingPlan.id, planFormData);
        setPlans(
          plans.map((p) =>
            p.id === editingPlan.id ? { ...p, ...planFormData } : p
          )
        );
      } else {
        // Create new plan
        const newPlan = await api.plans.create(planFormData);
        setPlans([...plans, newPlan]);
      }
      setEditingPlan(null);
      setIsCreatingPlan(false);
      setPlanFormData({
        name: "",
        documentLimit: 5,
        docSizeLimitMB: 10,
        pricingDiscount: 0,
        fallbackMarkup: 0.5,
      });
    } catch (error) {
      console.error("Failed to save plan:", error);
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanFormData({
      name: plan.name,
      documentLimit: plan.documentLimit,
      docSizeLimitMB: plan.docSizeLimitMB,
      pricingDiscount: plan.pricingDiscount,
      fallbackMarkup: plan.fallbackMarkup,
    });
    setIsCreatingPlan(true);
  };

  const handleDeletePlan = async (planId: string) => {
    const plan = plans.find((p) => p.id === planId) || null;
    setPlanToDelete(plan);
    setShowDeletePlanModal(true);
  };

  const handleConfirmDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      await api.plans.delete(planToDelete.id);
      setPlans((prev) => prev.filter((p) => p.id !== planToDelete.id));
      setShowDeletePlanModal(false);
      setPlanToDelete(null);
    } catch (error) {
      console.error("Failed to delete plan:", error);
      setSettingsAlertModal({
        isOpen: true,
        title: "Delete failed",
        message: "Failed to delete plan. Please try again.",
        type: "error",
      });
    }
  };

  const handleCancelDeletePlan = () => {
    setShowDeletePlanModal(false);
    setPlanToDelete(null);
  };

  const handleCancelPlanEdit = () => {
    setEditingPlan(null);
    setIsCreatingPlan(false);
    setPlanFormData({
      name: "",
      documentLimit: 5,
      docSizeLimitMB: 10,
      pricingDiscount: 0,
      fallbackMarkup: 0.5,
    });
  };

  const allTabs: Array<{
    id: string;
    label: string;
    icon: any;
    roles: Array<"SUPER_ADMIN" | "TENANT_ADMIN" | "AGENT" | "CUSTOMER">;
  }> = [
    {
      id: "general",
      label: "General",
      icon: User,
      roles: ["SUPER_ADMIN", "TENANT_ADMIN", "AGENT"],
    },
    {
      id: "organization",
      label: "Organization",
      icon: Building,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "web-phone",
      label: "Web Phone",
      icon: Phone,
      roles: ["TENANT_ADMIN", "SUPER_ADMIN"],
    },
    {
      id: "extensions",
      label: "Extensions",
      icon: Users,
      roles: ["TENANT_ADMIN", "SUPER_ADMIN", "AGENT"],
    },
    {
      id: "ai-agent",
      label: "AI Agent",
      icon: Bot,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "installation",
      label: "Installation",
      icon: Code,
      roles: ["TENANT_ADMIN"],
    },
    {
      id: "security",
      label: "Security",
      icon: Shield,
      roles: ["SUPER_ADMIN", "TENANT_ADMIN", "AGENT"],
    },
    {
      id: "plans",
      label: "Plans",
      icon: PackageOpen,
      roles: ["SUPER_ADMIN"],
    },
  ];

  // Keep these tabs available via Telephony sidebar deep-links
  // (Settings page should not show duplicate menu items).
  const hiddenFromSettingsMenu = new Set(["web-phone", "extensions"]);

  const allowedTabs = allTabs.filter((t) =>
    t.roles.includes((user?.role || "AGENT") as any)
  );

  const navTabs = allowedTabs.filter((t) => !hiddenFromSettingsMenu.has(t.id));

  useEffect(() => {
    const applyHashTab = () => {
      try {
        const raw = String(window.location.hash || "");
        const hash = raw.startsWith("#") ? raw.slice(1) : raw;
        const tabId = decodeURIComponent(hash || "").trim();
        if (!tabId) return;

        const allowed = new Set(allowedTabs.map((t) => t.id));
        if (allowed.has(tabId)) {
          setActiveTab(tabId);
        }
      } catch {
        // ignore
      }
    };

    applyHashTab();
    window.addEventListener("hashchange", applyHashTab);
    return () => window.removeEventListener("hashchange", applyHashTab);
  }, [allowedTabs]);

  useEffect(() => {
    if (!user) return;
    const allowedIds = new Set(allowedTabs.map((t) => t.id));
    if (!allowedIds.has(activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "general");
    }
  }, [user, activeTab, allowedTabs]);

  return (
    <div className="flex-1 bg-slate-50 h-full flex overflow-hidden">
      {/* Settings Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full overflow-y-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-xs text-slate-500 mt-1">Manage workspace & AI</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl">
          {/* --- AI AGENT CONFIG --- */}
          {activeTab === "ai-agent" && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  AI Agent Configuration
                </h2>
                <p className="text-slate-500">
                  Define how your AI behaves, speaks, and interacts with
                  customers.
                </p>
              </div>

              {/* Persona */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <User size={18} className="text-indigo-500" /> Agent Persona
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Agent Name
                    </label>
                    <input
                      type="text"
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Tone of Voice
                    </label>
                    <select
                      value={toneOfVoice}
                      onChange={(e) => setToneOfVoice(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option>Friendly & Casual</option>
                      <option>Professional & Formal</option>
                      <option>Empathetic & Calm</option>
                      <option>Technical & Precise</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Business Description
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Briefly describe your business, products, and services. This
                    helps the AI answer general questions accurately.
                  </p>
                  <textarea
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    rows={3}
                    placeholder="e.g. Acme Inc. sells high-quality anvils and roadrunner traps..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* System Prompt */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Bot size={18} className="text-indigo-500" /> System
                  Instructions
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  The core "brain" of your agent. Define rules, knowledge
                  boundaries, and behavioral guidelines.
                </p>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm leading-relaxed"
                />
              </div>

              {/* Phone Voice Settings Component */}
              {user?.tenantId && (
                <PhoneVoiceSettings tenantId={user.tenantId} />
              )}

              {/* Handoff Rules */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Shield size={18} className="text-indigo-500" /> Handoff &
                  Escalation
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700">
                        Confidence Threshold
                      </label>
                      <span className="text-sm font-bold text-indigo-600">
                        {Math.round(handoffThreshold * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={handoffThreshold}
                      onChange={(e) =>
                        setHandoffThreshold(parseFloat(e.target.value))
                      }
                      className="w-full accent-indigo-600"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      If AI confidence drops below this level, conversation is
                      flagged for a human.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-3">
                    <input
                      type="checkbox"
                      checked={autoEscalate}
                      onChange={(e) => setAutoEscalate(e.target.checked)}
                      id="sentiment"
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="sentiment"
                      className="text-sm text-slate-700"
                    >
                      Auto-escalate on <strong>Negative Sentiment</strong>{" "}
                      detection
                    </label>
                  </div>
                </div>
              </div>

              {/* Intent Detection */}
              <IntentManagement />

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveAiConfig}
                  disabled={saving}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={18} />{" "}
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
              </div>

              {/* Test Chat Widget */}
              <div className="pt-8 border-t border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                  Test Your Agent
                </h2>
                <TestChatWidget />
              </div>
            </div>
          )}

          {/* --- INSTALLATION (EXPORT) --- */}
          {activeTab === "installation" && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Install Chat Widget
                </h2>
                <p className="text-slate-500">
                  Export your AI agent and add it to your website.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Code size={18} className="text-indigo-500" /> Embed Code
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Copy and paste this code snippet before the closing{" "}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-xs">
                    &lt;/body&gt;
                  </code>{" "}
                  tag on every page of your website.
                </p>

                <div className="relative group">
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={handleCopyCode}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm ${
                        copied
                          ? "bg-green-500 text-white border-green-600"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-slate-300 p-5 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                    {embedCode}
                  </pre>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-indigo-300 transition-colors">
                  <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center mb-4">
                    <Terminal size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">
                    Standard HTML
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Works with any static site, PHP, or legacy CMS.
                  </p>
                  <button className="text-sm font-medium text-indigo-600 hover:underline">
                    View Guide &rarr;
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-indigo-300 transition-colors">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                    <LayoutTemplate size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">
                    React / Next.js
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Install our NPM package for better type safety.
                  </p>
                  <code className="block bg-slate-100 px-3 py-2 rounded text-xs font-mono text-slate-600 mb-4">
                    npm install @connectflo/react
                  </code>
                  <button className="text-sm font-medium text-indigo-600 hover:underline">
                    View Docs &rarr;
                  </button>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-6 flex items-start gap-4">
                <AlertCircle className="text-indigo-600 shrink-0" size={24} />
                <div>
                  <h4 className="font-bold text-indigo-900 text-sm mb-1">
                    Need help installing?
                  </h4>
                  <p className="text-xs text-indigo-700 mb-3">
                    Our support team can help you integrate the widget into your
                    specific platform (Shopify, WordPress, Wix, etc.).
                  </p>
                  <button className="text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-700">
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- ORGANIZATION --- */}
          {activeTab === "organization" && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Organization Profile
                </h2>
                <p className="text-slate-500">
                  Manage branding and company details for the chat widget.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
                    <Upload size={24} className="mb-1" />
                    <span className="text-xs font-medium">Upload Logo</span>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Company Name
                      </label>
                      <input
                        type="text"
                        defaultValue={tenant?.name || "ConnectFlo Inc."}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Website URL
                      </label>
                      <input
                        type="text"
                        defaultValue={
                          tenant?.slug
                            ? `https://${tenant.slug}.connectflo.com`
                            : "https://connectflo.com"
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {(user?.role === "TENANT_ADMIN" ||
                user?.role === "SUPER_ADMIN") && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-indigo-500" /> Business
                    Hours
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Time Zone
                      </label>
                      <select
                        value={businessTimeZone}
                        onChange={(e) => setBusinessTimeZone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        disabled={businessHoursLoading}
                      >
                        {timeZoneOptions.map((tz) => (
                          <option key={tz} value={tz}>
                            {formatTimeZoneLabel(tz)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                        Used to determine open/closed for calls and chats.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Chat After-Hours Mode
                      </label>
                      <select
                        value={chatAfterHoursMode}
                        onChange={(e) =>
                          setChatAfterHoursMode(
                            e.target.value as
                              | "ONLY_ON_ESCALATION"
                              | "ALWAYS"
                              | "NEVER"
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        disabled={businessHoursLoading}
                      >
                        <option value="ONLY_ON_ESCALATION">
                          Only when escalation needed
                        </option>
                        <option value="ALWAYS">Always</option>
                        <option value="NEVER">Never</option>
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                        Applies to AI auto-replies after hours.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        Max Meeting Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        value={maxMeetingDurationMinutes}
                        onChange={(e) => {
                          const v = parseInt(String(e.target.value || "0"), 10);
                          const clamped = Number.isFinite(v)
                            ? Math.min(480, Math.max(5, v))
                            : 60;
                          setMaxMeetingDurationMinutes(clamped);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        disabled={businessHoursLoading}
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Used to enforce booking limits for chat/call scheduling.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={calendarAutoAddMeet}
                        onChange={(e) =>
                          setCalendarAutoAddMeet(e.target.checked)
                        }
                        disabled={businessHoursLoading}
                      />
                      <span>
                        <span className="block text-sm text-slate-700 font-medium">
                          Auto-add Google Meet link
                        </span>
                        <span className="block text-xs text-slate-400">
                          When enabled, new Google Calendar events will include
                          a Meet link.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
                      Weekly Schedule
                    </label>
                    <div className="space-y-2">
                      {(
                        [
                          ["mon", "Mon"],
                          ["tue", "Tue"],
                          ["wed", "Wed"],
                          ["thu", "Thu"],
                          ["fri", "Fri"],
                          ["sat", "Sat"],
                          ["sun", "Sun"],
                        ] as const
                      ).map(([key, label]) => {
                        const day =
                          businessHours?.days?.[key] ||
                          defaultBusinessHours.days[key];

                        return (
                          <div
                            key={key}
                            className="grid grid-cols-12 gap-3 items-center"
                          >
                            <div className="col-span-2 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(day.enabled)}
                                onChange={(e) => {
                                  const next = {
                                    ...businessHours,
                                    days: {
                                      ...businessHours.days,
                                      [key]: {
                                        ...day,
                                        enabled: e.target.checked,
                                      },
                                    },
                                  };
                                  setBusinessHours(next);
                                }}
                                disabled={businessHoursLoading}
                              />
                              <span className="text-sm text-slate-700 font-medium">
                                {label}
                              </span>
                            </div>

                            <div className="col-span-5">
                              <input
                                type="time"
                                value={day.start}
                                onChange={(e) => {
                                  const next = {
                                    ...businessHours,
                                    days: {
                                      ...businessHours.days,
                                      [key]: { ...day, start: e.target.value },
                                    },
                                  };
                                  setBusinessHours(next);
                                }}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                disabled={businessHoursLoading || !day.enabled}
                              />
                            </div>
                            <div className="col-span-5">
                              <input
                                type="time"
                                value={day.end}
                                onChange={(e) => {
                                  const next = {
                                    ...businessHours,
                                    days: {
                                      ...businessHours.days,
                                      [key]: { ...day, end: e.target.value },
                                    },
                                  };
                                  setBusinessHours(next);
                                }}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                disabled={businessHoursLoading || !day.enabled}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Chat After-Hours Message
                    </label>
                    <textarea
                      value={chatAfterHoursMessage}
                      onChange={(e) => setChatAfterHoursMessage(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Optional. If empty, a default message is used."
                      disabled={businessHoursLoading}
                    />
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={handleSaveBusinessHours}
                      disabled={businessHoursSaving || businessHoursLoading}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Save size={16} />
                      {businessHoursSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Palette size={18} className="text-indigo-500" /> Widget
                  Branding
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        defaultValue="#4f46e5"
                        className="w-10 h-10 p-1 rounded border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        defaultValue="#4f46e5"
                        className="px-3 py-2 border border-slate-300 rounded-lg w-28 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Widget Position
                    </label>
                    <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                      <option>Bottom Right</option>
                      <option>Bottom Left</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- PLANS (SUPER ADMIN ONLY) --- */}
          {activeTab === "plans" && user?.role === "SUPER_ADMIN" && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Plan Management
                  </h2>
                  <p className="text-slate-500">
                    Configure subscription plans and pricing
                  </p>
                </div>
                {!isCreatingPlan && (
                  <button
                    onClick={() => setIsCreatingPlan(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700"
                  >
                    <Plus size={18} />
                    Create Plan
                  </button>
                )}
              </div>

              {/* Create/Edit Plan Form */}
              {isCreatingPlan && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4">
                    {editingPlan ? "Edit Plan" : "Create New Plan"}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Plan Name
                      </label>
                      <input
                        type="text"
                        value={planFormData.name}
                        onChange={(e) =>
                          setPlanFormData({
                            ...planFormData,
                            name: e.target.value,
                          })
                        }
                        placeholder="e.g., STARTER, PRO, ENTERPRISE"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Document Limit
                        </label>
                        <input
                          type="number"
                          value={planFormData.documentLimit}
                          onChange={(e) =>
                            setPlanFormData({
                              ...planFormData,
                              documentLimit: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Max File Size (MB)
                        </label>
                        <input
                          type="number"
                          value={planFormData.docSizeLimitMB}
                          onChange={(e) =>
                            setPlanFormData({
                              ...planFormData,
                              docSizeLimitMB: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Pricing Discount (0-1)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={planFormData.pricingDiscount}
                          onChange={(e) =>
                            setPlanFormData({
                              ...planFormData,
                              pricingDiscount: parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          0 = no discount, 0.10 = 10% off tier prices
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Fallback Markup (e.g., 0.5)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={planFormData.fallbackMarkup}
                          onChange={(e) =>
                            setPlanFormData({
                              ...planFormData,
                              fallbackMarkup: parseFloat(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          0.5 = 50% markup for numbers outside tiers
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSavePlan}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700"
                      >
                        {editingPlan ? "Update Plan" : "Create Plan"}
                      </button>
                      <button
                        onClick={handleCancelPlanEdit}
                        className="border border-slate-300 text-slate-700 px-6 py-2 rounded-lg font-medium hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Plans List */}
              <div className="space-y-4">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-slate-900">
                          {plan.name}
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                          <div>
                            <span className="text-slate-500">
                              Document Limit:
                            </span>
                            <span className="ml-2 font-medium text-slate-900">
                              {plan.documentLimit}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">
                              Max File Size:
                            </span>
                            <span className="ml-2 font-medium text-slate-900">
                              {plan.docSizeLimitMB} MB
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">
                              Pricing Discount:
                            </span>
                            <span className="ml-2 font-medium text-slate-900">
                              {(plan.pricingDiscount * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">
                              Fallback Markup:
                            </span>
                            <span className="ml-2 font-medium text-slate-900">
                              {(plan.fallbackMarkup * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEditPlan(plan)}
                          className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {plans.length === 0 && !isCreatingPlan && (
                  <div className="text-center py-12 text-slate-500">
                    <PackageOpen
                      size={48}
                      className="mx-auto mb-4 opacity-50"
                    />
                    <p>
                      No plans created yet. Create your first plan to get
                      started.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- SECURITY --- */}
          {activeTab === "security" && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Security Settings
                </h2>
                <p className="text-slate-500">
                  Protect your account with multi-level security.
                </p>
              </div>

              {securityLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <>
                  {/* Security Progress Bar */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800">
                        Security Level: {getSecurityLevel()}/3
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          getSecurityLevel() === 3
                            ? "bg-green-100 text-green-700"
                            : getSecurityLevel() === 2
                            ? "bg-blue-100 text-blue-700"
                            : getSecurityLevel() === 1
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {getSecurityLevel() === 3
                          ? "Fully Secured"
                          : getSecurityLevel() === 2
                          ? "Good"
                          : getSecurityLevel() === 1
                          ? "Basic"
                          : "Not Verified"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                      <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 transition-all duration-500"
                        style={{
                          width: `${(getSecurityLevel() / 3) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Email</span>
                      <span>Phone</span>
                      <span>2FA</span>
                    </div>
                  </div>

                  {/* Security Levels */}
                  <div className="space-y-4">
                    {/* Level 1: Email Verification */}
                    <div
                      className={`bg-white rounded-xl border-2 ${
                        securityStatus.emailVerified
                          ? "border-green-200 bg-green-50"
                          : "border-slate-200"
                      } shadow-sm p-6`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              securityStatus.emailVerified
                                ? "bg-green-500"
                                : "bg-slate-300"
                            }`}
                          >
                            {securityStatus.emailVerified ? (
                              <CheckCircle className="w-6 h-6 text-white" />
                            ) : (
                              <Mail className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-bold text-slate-800">
                                Level 1: Email Verification
                              </h3>
                              {securityStatus.emailVerified && (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                                  Verified
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Confirms your identity and enables basic account
                              access.
                            </p>
                            <div className="text-sm text-slate-500">
                              <strong>Unlocks:</strong> Dashboard, Inbox,
                              Workflows, Knowledge Base
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Level 2: Phone Verification */}
                    <div
                      className={`bg-white rounded-xl border-2 ${
                        securityStatus.phoneVerified
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200"
                      } shadow-sm p-6`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              securityStatus.phoneVerified
                                ? "bg-blue-500"
                                : "bg-slate-300"
                            }`}
                          >
                            {securityStatus.phoneVerified ? (
                              <CheckCircle className="w-6 h-6 text-white" />
                            ) : (
                              <Phone className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-bold text-slate-800">
                                Level 2: Phone Verification
                              </h3>
                              {securityStatus.phoneVerified && (
                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                  Verified
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Verify your phone number via SMS to unlock voice
                              features and billing access.
                            </p>
                            <div className="text-sm text-slate-500 mb-4">
                              <strong>Unlocks:</strong> Voice Calls, Phone
                              Numbers, Voicemails, View Billing
                            </div>
                            {!securityStatus.phoneVerified && (
                              <button
                                onClick={() => setShowPhoneVerification(true)}
                                disabled={!securityStatus.emailVerified}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {!securityStatus.emailVerified && (
                                  <Lock className="w-4 h-4" />
                                )}
                                {securityStatus.emailVerified
                                  ? "Verify Phone"
                                  : "Complete Email First"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Level 3: Two-Factor Authentication */}
                    <div
                      className={`bg-white rounded-xl border-2 ${
                        securityStatus.mfaEnabled
                          ? "border-purple-200 bg-purple-50"
                          : "border-slate-200"
                      } shadow-sm p-6`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              securityStatus.mfaEnabled
                                ? "bg-purple-500"
                                : "bg-slate-300"
                            }`}
                          >
                            {securityStatus.mfaEnabled ? (
                              <CheckCircle className="w-6 h-6 text-white" />
                            ) : (
                              <Shield className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-bold text-slate-800">
                                Level 3: Two-Factor Authentication (TOTP)
                              </h3>
                              {securityStatus.mfaEnabled && (
                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">
                                  Enabled
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mb-3">
                              Add an extra layer of security with authenticator
                              app protection.
                              <strong className="block mt-2 text-blue-600">
                                Recommended for enhanced account security
                              </strong>
                            </p>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                              <div className="flex items-start gap-2">
                                <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-800">
                                  <strong>Security Benefits:</strong>
                                  <ul className="list-disc list-inside mt-1 space-y-1">
                                    <li>Protects against password theft</li>
                                    <li>Prevents unauthorized access</li>
                                    <li>Secures sensitive operations</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                            {!securityStatus.mfaEnabled && (
                              <button
                                onClick={() => setShowTOTPSetup(true)}
                                disabled={!securityStatus.phoneVerified}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {!securityStatus.phoneVerified && (
                                  <Lock className="w-4 h-4" />
                                )}
                                {securityStatus.phoneVerified
                                  ? "Enable 2FA (Recommended)"
                                  : "Complete Phone First"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Google Authentication */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                          <svg
                            viewBox="0 0 24 24"
                            className="w-6 h-6"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              fill="#EA4335"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">
                            Google Authentication
                          </h3>
                          <p className="text-sm text-slate-500">
                            {securityStatus.isGoogleUser
                              ? "Your account is linked with Google"
                              : "Link your Google account for easy sign-in"}
                          </p>
                        </div>
                      </div>
                      <div>
                        {securityStatus.isGoogleUser ? (
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold">
                            <CheckCircle className="w-4 h-4" />
                            Connected
                          </div>
                        ) : (
                          <button
                            onClick={handleLinkGoogleAccount}
                            disabled={googleAuthLinking}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {googleAuthLinking ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Linking...
                              </>
                            ) : (
                              "Link Google Account"
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Session Timeout */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-800 mb-2">
                      Session Timeout
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                      Automatically log out after inactivity
                    </p>
                    <select className="w-64 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm">
                      <option>15 minutes</option>
                      <option>30 minutes</option>
                      <option selected>1 hour</option>
                      <option>4 hours</option>
                      <option>Never</option>
                    </select>
                  </div>
                </>
              )}

              {/* Phone Verification Modal */}
              {showPhoneVerification && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl max-w-md w-full p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-slate-800">
                        Phone Verification
                      </h3>
                      <button
                        onClick={() => setShowPhoneVerification(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <XCircle className="w-6 h-6" />
                      </button>
                    </div>
                    <PhoneVerification
                      onVerified={handlePhoneVerificationComplete}
                    />
                  </div>
                </div>
              )}

              {/* TOTP Setup Modal */}
              {showTOTPSetup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl max-w-md w-full p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-slate-800">
                        Setup Two-Factor Authentication
                      </h3>
                      <button
                        onClick={() => setShowTOTPSetup(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <XCircle className="w-6 h-6" />
                      </button>
                    </div>
                    <TOTPSetup onSetupComplete={handleTOTPSetupComplete} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- GENERAL (Profile) --- */}
          {activeTab === "general" && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Your Profile
                </h2>
                <p className="text-slate-500">
                  Manage your personal account details.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-6 mb-6">
                  <img
                    src={
                      user?.avatar ||
                      "https://ui-avatars.com/api/?name=" +
                        (user?.name || "User")
                    }
                    className="w-20 h-20 rounded-full border-2 border-slate-100"
                    alt=""
                  />
                  <div>
                    <button className="text-sm font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100">
                      Change Avatar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.name}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
                  <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700">
                    Update Profile
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-2">Time Zone</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Detected locally:{" "}
                  <span className="font-medium">
                    {formatTimeZoneLabel(detectedTimeZone)}
                  </span>
                </p>

                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                  <select
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="w-full md:w-[28rem] px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm"
                  >
                    {timeZoneOptions.map((tz) => (
                      <option key={tz} value={tz}>
                        {formatTimeZoneLabel(tz)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={timeZoneSaving}
                    onClick={async () => {
                      try {
                        setTimeZoneSaving(true);
                        const result = await api.me.setTimeZone(
                          timeZone || null
                        );

                        // Keep localStorage user in sync for convenience elsewhere.
                        const userStr = localStorage.getItem("user");
                        if (userStr) {
                          const current = JSON.parse(userStr);
                          const updated = {
                            ...current,
                            timeZone: result.timeZone || undefined,
                          };
                          localStorage.setItem("user", JSON.stringify(updated));
                          setUser(updated);
                        }
                      } catch (e) {
                        console.error("Failed to update time zone", e);
                      } finally {
                        setTimeZoneSaving(false);
                      }
                    }}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {timeZoneSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              {(user?.role === "TENANT_ADMIN" || user?.role === "AGENT") && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 mb-2">
                        Working hours
                      </h3>
                      <p className="text-sm text-slate-500">
                        Used for scheduling when a workflow is assigned to you.
                      </p>
                      <div className="mt-3 text-sm text-slate-700">
                        <div>
                          <span className="font-semibold">Hours:</span>{" "}
                          {scheduleLoading
                            ? "Loading…"
                            : summarizeWorkingHours(myWorkingHours)}
                        </div>
                        <div className="mt-1">
                          <span className="font-semibold">Time zone:</span>{" "}
                          {myAgentTimeZone
                            ? formatTimeZoneLabel(myAgentTimeZone)
                            : `Tenant default — ${formatTimeZoneLabel(
                                tenantScheduleTimeZone ||
                                  businessTimeZone ||
                                  detectedTimeZone
                              )}`}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={scheduleLoading || scheduleSaving}
                      onClick={() => setScheduleModalOpen(true)}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      <Clock size={16} />
                      {scheduleSaving ? "Saving…" : "Edit"}
                    </button>
                  </div>
                </div>
              )}

              <WorkingHoursModal
                isOpen={scheduleModalOpen}
                memberName={user?.name || user?.email || ""}
                tenantTimeZone={
                  tenantScheduleTimeZone || businessTimeZone || detectedTimeZone
                }
                initialAgentTimeZone={myAgentTimeZone}
                initialWorkingHours={myWorkingHours}
                canEdit={true}
                onCancel={() => setScheduleModalOpen(false)}
                onSave={async (data) => {
                  try {
                    setScheduleSaving(true);
                    const result = await api.me.setSchedule({
                      agentTimeZone: data.agentTimeZone,
                      workingHours:
                        data.workingHours as WorkingHoursConfig | null,
                    });
                    setMyAgentTimeZone(result.agentTimeZone ?? null);
                    setMyWorkingHours((result as any)?.workingHours ?? null);
                    setScheduleModalOpen(false);
                  } catch (e) {
                    console.error("Failed to update schedule", e);
                  } finally {
                    setScheduleSaving(false);
                  }
                }}
              />
            </div>
          )}

          {/* --- WEB PHONE (TENANT ADMIN / SUPER ADMIN) --- */}
          {activeTab === "web-phone" &&
            (user?.role === "TENANT_ADMIN" || user?.role === "SUPER_ADMIN") && (
              <div className="space-y-8 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Web Phone
                  </h2>
                  <p className="text-slate-500">
                    Control whether agents can use the in-app browser dialer.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Phone size={18} className="text-indigo-500" /> Web Phone
                    Access
                  </h3>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={webPhoneEnabled}
                      onChange={(e) =>
                        handleToggleWebPhoneEnabled(e.target.checked)
                      }
                      disabled={webPhoneLoading || webPhoneSaving}
                    />
                    <span>
                      <span className="block text-sm text-slate-700 font-medium">
                        Enable Web Phone for agents
                      </span>
                      <span className="block text-xs text-slate-400">
                        When enabled, agents will see the dialer button and can
                        take calls in the browser.
                      </span>
                    </span>
                  </label>

                  {(webPhoneLoading || webPhoneSaving) && (
                    <div className="mt-2 text-xs text-slate-500">
                      {webPhoneLoading ? "Loading..." : "Saving..."}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Phone size={18} className="text-indigo-500" /> Outbound
                    Caller Settings
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Outbound caller number
                      </label>
                      <p className="text-xs text-slate-400 mb-2">
                        This number will be used as the caller ID for browser
                        outbound calls.
                      </p>
                      <select
                        value={webPhoneOutboundCallerNumber}
                        onChange={(e) =>
                          setWebPhoneOutboundCallerNumber(e.target.value)
                        }
                        disabled={webPhoneLoading || webPhoneSaving}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900"
                      >
                        <option value="">Use tenant default</option>
                        {callerIdNumbers.map((n) => (
                          <option key={n.id} value={n.number}>
                            {n.friendlyName ? `${n.friendlyName} — ` : ""}
                            {n.number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Business caller name
                      </label>
                      <p className="text-xs text-slate-400 mb-2">
                        Used for display in the app. Phone carrier caller-name
                        display (CNAM) may not reflect this value.
                      </p>
                      <input
                        type="text"
                        value={webPhoneOutboundCallerName}
                        onChange={(e) =>
                          setWebPhoneOutboundCallerName(e.target.value)
                        }
                        disabled={webPhoneLoading || webPhoneSaving}
                        placeholder="Example: Acme Plumbing"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={handleSaveWebPhoneOutboundSettings}
                        disabled={webPhoneLoading || webPhoneSaving}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {webPhoneSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* --- EXTENSIONS --- */}
          {activeTab === "extensions" && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Extensions</h2>
                <p className="text-slate-500">
                  Assign internal extension numbers for free VoIP calling
                  between team members.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Phone size={18} className="text-indigo-500" /> Assign
                  Extension
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1.5fr] gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Team Member
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => handleTeamMemberSelect(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        disabled={extensionSaving}
                      >
                        <option value="">Select a team member...</option>
                        {teamMembers.map((member) => {
                          const hasExtension = extensions.find(
                            (e) => e.userId === member.id
                          );
                          return (
                            <option key={member.id} value={member.id}>
                              {member.name} ({member.email})
                              {hasExtension
                                ? ` - Ext. ${hasExtension.extension}`
                                : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 whitespace-nowrap">
                        Extension (3-4 digits)
                      </label>
                      <input
                        type="text"
                        value={assignExtension}
                        onChange={(e) => {
                          const val = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4);
                          setAssignExtension(val);
                        }}
                        placeholder="e.g., 101"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        disabled={extensionSaving || !selectedUserId}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Label (optional)
                      </label>
                      <input
                        type="text"
                        value={assignExtensionLabel}
                        onChange={(e) =>
                          setAssignExtensionLabel(e.target.value)
                        }
                        placeholder="e.g., Sales, Support, Main Desk"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        disabled={extensionSaving || !selectedUserId}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Team members can call each other at their extensions for
                    FREE via VoIP
                  </p>

                  <div className="flex items-center justify-end gap-3">
                    {selectedUserId &&
                      extensions.find((e) => e.userId === selectedUserId) && (
                        <button
                          onClick={() => handleRemoveExtension(selectedUserId)}
                          disabled={extensionSaving}
                          className="text-red-600 px-6 py-2 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove Extension
                        </button>
                      )}
                    <button
                      onClick={handleAssignExtension}
                      disabled={
                        extensionSaving ||
                        !selectedUserId ||
                        !assignExtension ||
                        assignExtension.length < 3
                      }
                      className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {extensionSaving ? "Saving…" : "Assign Extension"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users size={18} className="text-indigo-500" /> Extension
                  Directory
                </h3>

                {extensionsLoading ? (
                  <div className="text-sm text-slate-500">
                    Loading extensions...
                  </div>
                ) : extensions.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No extensions assigned yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {extensions.map((ext) => (
                      <div
                        key={ext.userId}
                        className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="font-mono font-bold text-lg text-indigo-600">
                            {ext.extension}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {ext.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {ext.label && (
                                <span className="mr-2">({ext.label})</span>
                              )}
                              {ext.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              ext.status === "ONLINE"
                                ? "bg-green-100 text-green-800"
                                : ext.status === "BUSY"
                                ? "bg-yellow-100 text-yellow-800"
                                : ext.status === "AWAY"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {ext.status}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedUserId(ext.userId);
                              setAssignExtension(ext.extension || "");
                              setAssignExtensionLabel(ext.label || "");
                              // Scroll to top to show the assignment form
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded-lg text-sm font-medium hover:bg-indigo-50"
                            disabled={extensionSaving}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveExtension(ext.userId)}
                            className="text-red-600 hover:text-red-800 px-3 py-1 rounded-lg text-sm font-medium hover:bg-red-50"
                            disabled={extensionSaving}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeletePlanModal}
        title="Delete plan?"
        message={
          planToDelete
            ? `This will permanently delete the plan “${planToDelete.name}”.`
            : "This will permanently delete the plan."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive
        onConfirm={handleConfirmDeletePlan}
        onCancel={handleCancelDeletePlan}
      />

      <AlertModal
        isOpen={settingsAlertModal.isOpen}
        title={settingsAlertModal.title}
        message={settingsAlertModal.message}
        type={settingsAlertModal.type}
        onClose={() =>
          setSettingsAlertModal((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
};

export default Settings;
