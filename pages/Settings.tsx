import React, { useState, useEffect } from "react";
import {
  User,
  Bell,
  Shield,
  Globe,
  Building,
  Bot,
  Users,
  CreditCard,
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
} from "lucide-react";
import { User as UserType, Plan } from "../types";
import { api } from "../services/api";
import TestChatWidget from "../components/TestChatWidget";
import PhoneVoiceSettings from "../components/PhoneVoiceSettings";

const TEAM_MEMBERS = [
  {
    id: 1,
    name: "Sarah Jenkins",
    email: "sarah@connectflo.com",
    role: "Admin",
    status: "Active",
    avatar: "https://picsum.photos/id/1005/100/100",
  },
  {
    id: 2,
    name: "Mike Chen",
    email: "mike@connectflo.com",
    role: "Agent",
    status: "Active",
    avatar: "https://picsum.photos/id/1012/100/100",
  },
  {
    id: 3,
    name: "Jessica Alva",
    email: "jessica@connectflo.com",
    role: "Agent",
    status: "Invited",
    avatar: "https://picsum.photos/id/1027/100/100",
  },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState("installation");
  const [user, setUser] = useState<UserType | null>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState(TEAM_MEMBERS);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUser(userData);

      // Update first team member to match logged in user for demo purposes
      setTeamMembers((prev) => [
        {
          ...prev[0],
          name: userData.name,
          email: userData.email,
          role: userData.role === "TENANT_ADMIN" ? "Admin" : "Agent",
          avatar:
            userData.avatar ||
            `https://ui-avatars.com/api/?name=${userData.name}`,
        },
        ...prev.slice(1),
      ]);

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
    if (confirm("Are you sure you want to delete this plan?")) {
      try {
        await api.plans.delete(planId);
        setPlans(plans.filter((p) => p.id !== planId));
      } catch (error) {
        console.error("Failed to delete plan:", error);
      }
    }
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

  const tabs = [
    { id: "general", label: "General", icon: User },
    { id: "organization", label: "Organization", icon: Building },
    { id: "ai-agent", label: "AI Agent", icon: Bot },
    { id: "installation", label: "Installation", icon: Code },
    { id: "team", label: "Team Members", icon: Users },
    { id: "billing", label: "Billing & Usage", icon: CreditCard },
    { id: "security", label: "Security", icon: Shield },
    ...(user?.role === "SUPER_ADMIN"
      ? [{ id: "plans", label: "Plans", icon: PackageOpen }]
      : []),
  ];

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

          {/* --- GENERAL --- */}
          {activeTab === "team" && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Team Management
                  </h2>
                  <p className="text-slate-500">
                    Manage access and roles for your support team.
                  </p>
                </div>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                  <Plus size={16} /> Invite Member
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-semibold">User</th>
                      <th className="px-6 py-3 font-semibold">Role</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teamMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={member.avatar}
                              alt=""
                              className="w-8 h-8 rounded-full"
                            />
                            <div>
                              <div className="font-bold text-slate-800">
                                {member.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                            {member.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                              member.status === "Active"
                                ? "bg-green-50 text-green-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                member.status === "Active"
                                  ? "bg-green-500"
                                  : "bg-amber-500"
                              }`}
                            ></span>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- BILLING --- */}
          {activeTab === "billing" && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Billing & Usage
                </h2>
                <p className="text-slate-500">
                  Manage your subscription plan and monitor AI costs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">
                        Pro Plan
                      </h3>
                      <p className="text-sm text-slate-500">
                        $49 / month • Billed Monthly
                      </p>
                    </div>
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                      Active
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm font-medium text-slate-700 mb-1">
                        <span>Voice Minutes</span>
                        <span>850 / 1,000</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: "85%" }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm font-medium text-slate-700 mb-1">
                        <span>AI Tokens</span>
                        <span>2.4M / 5.0M</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full"
                          style={{ width: "48%" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex gap-3">
                    <button className="text-sm font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100">
                      Upgrade Plan
                    </button>
                    <button className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2">
                      View Invoices
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 mb-4">
                      Payment Method
                    </h3>
                    <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                      <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-red-500 opacity-50"></div>
                        <div className="w-4 h-4 rounded-full bg-yellow-500 opacity-50 -ml-2"></div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-700">
                          •••• 4242
                        </div>
                        <div className="text-xs text-slate-400">
                          Expires 12/25
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="w-full mt-4 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                    Update Card
                  </button>
                </div>
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
    </div>
  );
};

export default Settings;
