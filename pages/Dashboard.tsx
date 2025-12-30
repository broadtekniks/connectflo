import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { api } from "../services/api";
import {
  MOCK_AGENT_LEADERBOARD,
  MOCK_SENTIMENT_HISTORY,
  MOCK_VOICE_COSTS,
  MOCK_INTENTS,
  MOCK_CONVERSATIONS,
} from "../constants";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Phone,
  Zap,
  Users,
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Activity,
  Clock,
  AlertCircle,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Sentiment } from "../types";

const overviewData = [
  { name: "Mon", chat: 40, voice: 24 },
  { name: "Tue", chat: 30, voice: 13 },
  { name: "Wed", chat: 20, voice: 58 },
  { name: "Thu", chat: 27, voice: 39 },
  { name: "Fri", chat: 18, voice: 48 },
  { name: "Sat", chat: 23, voice: 38 },
  { name: "Sun", chat: 34, voice: 43 },
];

const pieData = [
  { name: "Resolved by AI", value: 65 },
  { name: "Escalated to Agent", value: 35 },
];

const COLORS = ["#6366f1", "#e2e8f0", "#10b981", "#f59e0b", "#ef4444"];

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  trend?: string;
  change?: number;
  icon?: React.ReactNode;
}> = ({ label, value, trend, change, icon }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-3xl font-bold text-slate-900">{value}</span>
          {change !== undefined && (
            <div
              className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                trend === "UP"
                  ? "text-green-700 bg-green-50"
                  : trend === "DOWN"
                  ? "text-red-700 bg-red-50"
                  : "text-slate-600 bg-slate-100"
              }`}
            >
              {trend === "UP" && <ArrowUp size={12} className="mr-1" />}
              {trend === "DOWN" && <ArrowDown size={12} className="mr-1" />}
              {trend === "FLAT" && <Minus size={12} className="mr-1" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
      </div>
      {icon && (
        <div className="p-2 bg-slate-50 rounded-lg text-slate-400">{icon}</div>
      )}
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "voice" | "ai" | "agents"
  >("overview");
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await api.metrics.get();
        setMetrics(data);
      } catch (error) {
        console.error("Failed to fetch metrics", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  // Filter for "Urgent" or "Open" tasks
  const urgentConversations = MOCK_CONVERSATIONS.filter(
    (c) => c.sentiment === Sentiment.NEGATIVE || c.priority === "HIGH"
  ).slice(0, 3);

  const displayMetrics = metrics
    ? [
        {
          label: "Total Conversations",
          value: metrics.totalConversations,
          trend: "UP",
          change: 12,
          icon: <LayoutDashboard size={20} />,
        },
        {
          label: "Open Conversations",
          value: metrics.openConversations,
          trend: "DOWN",
          change: 5,
          icon: <Clock size={20} />,
        },
        {
          label: "Resolution Rate",
          value: `${metrics.resolutionRate}%`,
          trend: "UP",
          change: 3,
          icon: <CheckCircle size={20} />,
        },
        {
          label: "Total Messages",
          value: metrics.totalMessages,
          trend: "FLAT",
          change: 0,
          icon: <Activity size={20} />,
        },
      ]
    : [
        {
          label: "Total Conversations",
          value: "-",
          icon: <LayoutDashboard size={20} />,
        },
        { label: "Open Conversations", value: "-", icon: <Clock size={20} /> },
        {
          label: "Resolution Rate",
          value: "-",
          icon: <CheckCircle size={20} />,
        },
        { label: "Total Messages", value: "-", icon: <Activity size={20} /> },
      ];

  return (
    <div className="flex-1 bg-slate-50 h-full flex flex-col overflow-hidden">
      {/* Header & Filters */}
      <div className="px-8 pt-8 pb-4 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500 mt-1">
                Real-time overview of your support operations.
              </p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>This Quarter</option>
              </select>
              <button className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm">
                Export Report
              </button>
            </div>
          </div>

          <div className="flex gap-6 border-b border-transparent">
            {[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "voice", label: "Voice & Telephony", icon: Phone },
              { id: "ai", label: "AI & Automation", icon: Zap },
              { id: "agents", label: "Agent Performance", icon: Users },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* --- OVERVIEW TAB --- */}
          {activeTab === "overview" && (
            <div className="space-y-8 animate-fade-in">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayMetrics.map((metric, index) => (
                  <MetricCard key={index} {...metric} />
                ))}
              </div>

              {/* Main Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6">
                    Channel Volume
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                      debounce={50}
                    >
                      <BarChart data={overviewData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="chat"
                          stackId="a"
                          fill="#6366f1"
                          radius={[0, 0, 4, 4]}
                          name="Chat"
                        />
                        <Bar
                          dataKey="voice"
                          stackId="a"
                          fill="#a5b4fc"
                          radius={[4, 4, 0, 0]}
                          name="Voice"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="font-bold text-slate-800 mb-2">
                    Automation Rate
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">
                    Sessions handled by AI vs Agents
                  </p>
                  <div className="h-80 w-full relative">
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                      debounce={50}
                    >
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                      <span className="text-3xl font-bold text-indigo-600">
                        65%
                      </span>
                      <span className="text-xs text-slate-400 font-medium uppercase">
                        Automated
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Urgent Tasks & System Status */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Urgent Tasks List */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <AlertCircle size={18} className="text-orange-500" />
                      Requires Attention
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {urgentConversations.length > 0 ? (
                      urgentConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="p-5 hover:bg-slate-50 transition-colors flex items-center gap-4 group cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0 overflow-hidden">
                            <img
                              src={conv.customer.avatar}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-slate-800 text-sm truncate">
                                {conv.customer.name}
                              </h4>
                              <span className="text-xs text-slate-400 whitespace-nowrap">
                                {new Date(conv.lastActivity).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 truncate">
                              {conv.messages[conv.messages.length - 1].content}
                            </p>
                          </div>
                          <div className="hidden group-hover:flex items-center">
                            <ArrowRight size={18} className="text-slate-300" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-500">
                        <CheckCircle
                          size={32}
                          className="mx-auto text-green-400 mb-2"
                        />
                        <p>All caught up! No urgent issues.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Status Widget */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4">
                    System Status
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Web Widget
                      </span>
                      <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">
                        Online
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Voice (SIP)
                      </span>
                      <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">
                        Operational
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Gemini AI
                      </span>
                      <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">
                        Operational
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- VOICE TAB --- */}
          {activeTab === "voice" && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                  label="Total Voice Minutes"
                  value="3,450"
                  change={12}
                  trend="UP"
                  icon={<Phone size={20} />}
                />
                <MetricCard
                  label="Avg Handle Time"
                  value="4m 12s"
                  change={-5}
                  trend="DOWN"
                  icon={<Clock size={20} />}
                />
                <MetricCard
                  label="Telephony Cost"
                  value="$145.20"
                  change={8}
                  trend="UP"
                  icon={<DollarSign size={20} />}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6">
                    Daily Cost & Usage
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                      debounce={50}
                    >
                      <BarChart data={MOCK_VOICE_COSTS}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke="#6366f1"
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#94a3b8"
                        />
                        <Tooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="cost"
                          name="Cost ($)"
                          fill="#6366f1"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="minutes"
                          name="Minutes"
                          fill="#e2e8f0"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-2">
                    Abandonment Rate
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">
                    Calls dropped before reaching an agent
                  </p>
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="w-40 h-40 rounded-full border-8 border-slate-100 border-t-red-500 flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl font-bold text-slate-800">
                          4.2%
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Below industry average (5.0%)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- AI TAB --- */}
          {activeTab === "ai" && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                  label="Tokens Used"
                  value="2.4M"
                  change={25}
                  trend="UP"
                  icon={<Zap size={20} />}
                />
                <MetricCard
                  label="Deflection Rate"
                  value="68%"
                  change={2}
                  trend="UP"
                  icon={<TrendingUp size={20} />}
                />
                <MetricCard
                  label="Est. Cost Savings"
                  value="$4,200"
                  change={15}
                  trend="UP"
                  icon={<DollarSign size={20} />}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6">
                    Sentiment Trends (Today)
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                      debounce={50}
                    >
                      <AreaChart data={MOCK_SENTIMENT_HISTORY}>
                        <defs>
                          <linearGradient
                            id="colorPos"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.1}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorNeg"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#ef4444"
                              stopOpacity={0.1}
                            />
                            <stop
                              offset="95%"
                              stopColor="#ef4444"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="positive"
                          stroke="#10b981"
                          fillOpacity={1}
                          fill="url(#colorPos)"
                          name="Positive %"
                        />
                        <Area
                          type="monotone"
                          dataKey="negative"
                          stroke="#ef4444"
                          fillOpacity={1}
                          fill="url(#colorNeg)"
                          name="Negative %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-6">
                    Top Detected Intents
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer
                      width="100%"
                      height={320}
                      debounce={50}
                    >
                      <BarChart
                        layout="vertical"
                        data={MOCK_INTENTS}
                        margin={{ left: 40 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis type="number" />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={100}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          fill="#6366f1"
                          radius={[0, 4, 4, 0]}
                          barSize={20}
                          name="Occurrences"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- AGENTS TAB --- */}
          {activeTab === "agents" && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">
                    Agent Leaderboard
                  </h3>
                  <span className="text-xs text-slate-500">Last 30 Days</span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Agent</th>
                      <th className="px-6 py-3 font-semibold">
                        Resolved Tickets
                      </th>
                      <th className="px-6 py-3 font-semibold">CSAT Score</th>
                      <th className="px-6 py-3 font-semibold">
                        Avg Handle Time
                      </th>
                      <th className="px-6 py-3 font-semibold text-right">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_AGENT_LEADERBOARD.map((agent) => (
                      <tr
                        key={agent.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={agent.avatar}
                              className="w-8 h-8 rounded-full"
                              alt=""
                            />
                            <span className="font-bold text-slate-700">
                              {agent.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {agent.resolved}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                agent.csat >= 4.8
                                  ? "text-green-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {agent.csat}
                            </span>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${(agent.csat / 5) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {agent.avgTime}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className="inline-block w-2 h-2 bg-green-500 rounded-full"
                            title="Online"
                          ></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
