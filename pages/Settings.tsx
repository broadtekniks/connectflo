import React, { useState, useEffect } from "react";
import {
  User,
  Bell,
  Shield,
  Globe,
  Building,
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
} from "lucide-react";
import { User as UserType, Plan } from "../types";
import { api } from "../services/api";
import TestChatWidget from "../components/TestChatWidget";
import PhoneVoiceSettings from "../components/PhoneVoiceSettings";
import AlertModal from "../components/AlertModal";
import ConfirmationModal from "../components/ConfirmationModal";

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

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);

      if (userData.tenantId) {
        api.tenants.get(userData.tenantId).then(setTenant).catch(console.error);
      }
    }
  }, []);

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

  const tabs = allTabs.filter((t) =>
    t.roles.includes((user?.role || "AGENT") as any)
  );

  useEffect(() => {
    if (!user) return;
    const allowedIds = new Set(tabs.map((t) => t.id));
    if (!allowedIds.has(activeTab)) {
      setActiveTab(tabs[0]?.id || "general");
    }
  }, [user, activeTab, tabs]);

  return (
    <div className="flex-1 bg-slate-50 h-full flex overflow-hidden">
      {/* Settings Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 h-full overflow-y-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-xs text-slate-500 mt-1">Manage workspace & AI</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {tabs.map((tab) => (
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
                  Protect your organization's data.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">
                      Two-Factor Authentication (2FA)
                    </h3>
                    <p className="text-sm text-slate-500">
                      Require 2FA for all agent logins.
                    </p>
                  </div>
                  <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer bg-slate-200">
                    <span className="absolute left-0 inline-block w-6 h-6 bg-white border border-slate-300 rounded-full shadow transform transition-transform duration-200 ease-in-out translate-x-0"></span>
                  </div>
                </div>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">
                      Single Sign-On (SSO)
                    </h3>
                    <p className="text-sm text-slate-500">
                      Allow login via Google Workspace or Okta.
                    </p>
                  </div>
                  <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer bg-indigo-600">
                    <span className="absolute left-0 inline-block w-6 h-6 bg-white border border-slate-300 rounded-full shadow transform transition-transform duration-200 ease-in-out translate-x-6"></span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-slate-800 mb-2">
                    Session Timeout
                  </h3>
                  <select className="w-64 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm">
                    <option>15 minutes</option>
                    <option>30 minutes</option>
                    <option selected>1 hour</option>
                    <option>4 hours</option>
                    <option>Never</option>
                  </select>
                </div>
              </div>
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
