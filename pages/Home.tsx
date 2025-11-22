
import React from 'react';
import { MOCK_METRICS, MOCK_CONVERSATIONS, CURRENT_USER } from '../constants';
import { ArrowUp, ArrowDown, Minus, MessageSquare, Zap, Users, Clock, Plus, ExternalLink, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { ConversationStatus, Sentiment } from '../types';

const MetricCard: React.FC<{ label: string; value: string | number; trend?: string; change?: number; icon: React.ReactNode; color: string }> = ({ label, value, trend, change, icon, color }) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${color} text-white`}>
                {icon}
            </div>
            {change !== undefined && (
                <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${
                    trend === 'UP' ? 'text-green-700 bg-green-50' : 
                    trend === 'DOWN' ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-100'
                }`}>
                    {trend === 'UP' && <ArrowUp size={12} className="mr-1" />}
                    {trend === 'DOWN' && <ArrowDown size={12} className="mr-1" />}
                    {trend === 'FLAT' && <Minus size={12} className="mr-1" />}
                    {Math.abs(change)}%
                </div>
            )}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
    </div>
);

const Home: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  // Filter for "Urgent" or "Open" tasks for the feed
  const urgentConversations = MOCK_CONVERSATIONS.filter(c => c.sentiment === Sentiment.NEGATIVE || c.priority === 'HIGH').slice(0, 3);

  return (
    <div className="flex-1 bg-slate-50 p-8 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Good morning, {CURRENT_USER.name.split(' ')[0]}</h1>
                <p className="text-slate-500 mt-2">Here's what's happening with your support team today.</p>
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
                <button 
                    onClick={() => onNavigate('inbox')}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                    View Inbox
                </button>
                <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                    <Plus size={18} /> New Ticket
                </button>
            </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
                label="Active Conversations" 
                value={MOCK_METRICS[0].value} 
                change={MOCK_METRICS[0].change} 
                trend={MOCK_METRICS[0].trend} 
                icon={<MessageSquare size={20} />}
                color="bg-blue-500"
            />
             <MetricCard 
                label="AI Resolution Rate" 
                value={MOCK_METRICS[1].value} 
                change={MOCK_METRICS[1].change} 
                trend={MOCK_METRICS[1].trend} 
                icon={<Zap size={20} />}
                color="bg-purple-500"
            />
             <MetricCard 
                label="Avg Response Time" 
                value={MOCK_METRICS[2].value} 
                change={MOCK_METRICS[2].change} 
                trend={MOCK_METRICS[2].trend} 
                icon={<Clock size={20} />}
                color="bg-orange-500"
            />
             <MetricCard 
                label="Customer Satisfaction" 
                value={MOCK_METRICS[3].value} 
                change={MOCK_METRICS[3].change} 
                trend={MOCK_METRICS[3].trend} 
                icon={<Users size={20} />}
                color="bg-green-500"
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Needs Attention */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Urgent Tasks */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertCircle size={18} className="text-orange-500" />
                            Requires Attention
                        </h3>
                        <button onClick={() => onNavigate('inbox')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {urgentConversations.length > 0 ? (
                            urgentConversations.map(conv => (
                                <div key={conv.id} className="p-5 hover:bg-slate-50 transition-colors flex items-center gap-4 group cursor-pointer" onClick={() => onNavigate('inbox')}>
                                    <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0 overflow-hidden">
                                        <img src={conv.customer.avatar} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{conv.customer.name}</h4>
                                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                                {new Date(conv.lastActivity).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 truncate">{conv.messages[conv.messages.length - 1].content}</p>
                                    </div>
                                    <div className="hidden group-hover:flex items-center">
                                        <ArrowRight size={18} className="text-slate-300" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
                                <p>All caught up! No urgent issues.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* AI Performance Mini-View */}
                <div className="bg-indigo-900 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                                <Zap size={20} className="text-yellow-400" /> AI Agent Performance
                            </h3>
                            <p className="text-indigo-200 text-sm">Your agent "Flo" is running smoothly.</p>
                        </div>
                        <button onClick={() => onNavigate('dashboard')} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm">
                            View Analytics
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-8 relative z-10">
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                            <span className="block text-2xl font-bold">142</span>
                            <span className="text-xs text-indigo-200">Auto-resolved today</span>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                            <span className="block text-2xl font-bold">1.2s</span>
                            <span className="text-xs text-indigo-200">Avg response time</span>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                            <span className="block text-2xl font-bold">$420</span>
                            <span className="text-xs text-indigo-200">Saved today</span>
                        </div>
                    </div>
                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2"></div>
                </div>
            </div>

            {/* Right Column: Quick Links & Status */}
            <div className="space-y-6">
                
                {/* Setup Checklist (Onboarding feeling) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">Getting Started</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-slate-600 line-through opacity-50">
                            <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0"><CheckCircle size={12} /></div>
                            <span>Create Account</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600 line-through opacity-50">
                            <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0"><CheckCircle size={12} /></div>
                            <span>Connect Channel</span>
                        </div>
                        <div 
                            className="flex items-center gap-3 text-sm text-slate-800 font-medium cursor-pointer hover:text-indigo-600 transition-colors"
                            onClick={() => onNavigate('integrations')}
                        >
                            <div className="w-5 h-5 rounded-full border-2 border-indigo-600 shrink-0"></div>
                            <span>Connect Integration</span>
                        </div>
                        <div 
                            className="flex items-center gap-3 text-sm text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors"
                            onClick={() => onNavigate('settings')}
                        >
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0"></div>
                            <span>Customize AI Persona</span>
                        </div>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => onNavigate('phone-numbers')}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all text-left"
                        >
                            <Clock size={20} className="mb-2 text-slate-400" />
                            <span className="block text-xs font-bold">Buy Number</span>
                        </button>
                         <button 
                            onClick={() => onNavigate('workflows')}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all text-left"
                        >
                            <Zap size={20} className="mb-2 text-slate-400" />
                            <span className="block text-xs font-bold">Create Flow</span>
                        </button>
                         <button 
                            onClick={() => onNavigate('knowledge')}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all text-left"
                        >
                            <ExternalLink size={20} className="mb-2 text-slate-400" />
                            <span className="block text-xs font-bold">Upload Doc</span>
                        </button>
                         <button 
                            onClick={() => onNavigate('settings')}
                            className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600 transition-all text-left"
                        >
                            <Users size={20} className="mb-2 text-slate-400" />
                            <span className="block text-xs font-bold">Add Agent</span>
                        </button>
                    </div>
                </div>

                {/* System Status */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                     <h3 className="font-bold text-slate-800 mb-4">System Status</h3>
                     <div className="space-y-4">
                         <div className="flex justify-between items-center text-sm">
                             <span className="flex items-center gap-2 text-slate-600">
                                 <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                 Web Widget
                             </span>
                             <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Online</span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                             <span className="flex items-center gap-2 text-slate-600">
                                 <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                 Voice (SIP)
                             </span>
                             <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Operational</span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                             <span className="flex items-center gap-2 text-slate-600">
                                 <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                 Gemini AI
                             </span>
                             <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Operational</span>
                         </div>
                     </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
