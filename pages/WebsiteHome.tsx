
import React from 'react';
import { MessageSquare, Zap, Workflow, Phone, Shield, Check, ArrowRight, Play, BarChart3, Globe, CheckCircle } from 'lucide-react';

interface WebsiteHomeProps {
  onNavigate: (view: string) => void;
}

const WebsiteHome: React.FC<WebsiteHomeProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
            <span className="text-xl font-bold tracking-tight text-slate-900">ConnectFlo</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <button onClick={() => onNavigate('pricing')} className="hover:text-indigo-600 transition-colors">Pricing</button>
            <button onClick={() => onNavigate('login')} className="hover:text-indigo-600 transition-colors">Log in</button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('login')} className="text-sm font-medium text-slate-600 hover:text-indigo-600 md:hidden">Log in</button>
            <button onClick={() => onNavigate('signup')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-100 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            New: Gemini 1.5 Integration
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
            Customer Support, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Reimagined with AI.</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Unify your inbox, automate workflows, and empower agents with an AI co-pilot that actually understands your business.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={() => onNavigate('signup')} className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-full font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
              Start Free Trial <ArrowRight size={20} />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-full font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <Play size={20} className="fill-slate-700" /> Watch Demo
            </button>
          </div>

          {/* Dashboard Preview Mockup */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden aspect-video flex flex-col">
              <div className="h-8 bg-slate-800 border-b border-slate-700 flex items-center gap-2 px-4 shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              {/* Abstract representation of the dashboard */}
              <div className="flex flex-1 overflow-hidden">
                <div className="w-48 bg-slate-800/50 border-r border-slate-700 p-4 space-y-4 hidden md:block shrink-0">
                   {[1,2,3,4,5].map(i => <div key={i} className="h-6 bg-slate-700/50 rounded w-full"></div>)}
                </div>
                <div className="flex-1 p-6 bg-slate-900 overflow-hidden">
                   <div className="grid grid-cols-3 gap-6 mb-8">
                      <div className="h-24 bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                         <div className="h-4 w-1/2 bg-indigo-500/40 rounded mb-2"></div>
                         <div className="h-8 w-3/4 bg-indigo-500/60 rounded"></div>
                      </div>
                      <div className="h-24 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                         <div className="h-4 w-1/2 bg-purple-500/40 rounded mb-2"></div>
                         <div className="h-8 w-3/4 bg-purple-500/60 rounded"></div>
                      </div>
                      <div className="h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                         <div className="h-4 w-1/2 bg-emerald-500/40 rounded mb-2"></div>
                         <div className="h-8 w-3/4 bg-emerald-500/60 rounded"></div>
                      </div>
                   </div>
                   <div className="h-full bg-slate-800/50 rounded-lg border border-slate-700 p-4 flex items-center justify-center text-slate-600">
                      <div className="text-center">
                          <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
                          <p>Real-time Analytics Dashboard</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section className="py-10 border-y border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Trusted by modern support teams</p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            <img src="https://cdn.simpleicons.org/shopify" className="h-8" alt="Shopify" />
            <img src="https://cdn.simpleicons.org/slack" className="h-8" alt="Slack" />
            <img src="https://cdn.simpleicons.org/stripe" className="h-8" alt="Stripe" />
            <img src="https://cdn.simpleicons.org/airbnb" className="h-8" alt="Airbnb" />
            <img src="https://cdn.simpleicons.org/netflix" className="h-8" alt="Netflix" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything you need to support customers at scale</h2>
            <p className="text-lg text-slate-500">From a unified inbox to complex automation workflows, ConnectFlo gives your team the superpowers they need.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare size={24} />,
                title: "Unified Inbox",
                desc: "Manage email, chat, voice, and SMS in one single view. No more tab switching.",
                color: "bg-blue-50 text-blue-600"
              },
              {
                icon: <Zap size={24} />,
                title: "AI Co-Pilot",
                desc: "Draft responses, summarize tickets, and analyze sentiment instantly with Gemini.",
                color: "bg-purple-50 text-purple-600"
              },
              {
                icon: <Workflow size={24} />,
                title: "Visual Workflows",
                desc: "Build drag-and-drop automations to route tickets and handle common queries.",
                color: "bg-orange-50 text-orange-600"
              },
              {
                icon: <Phone size={24} />,
                title: "Cloud Voice",
                desc: "Purchase numbers and handle inbound calls directly in the browser.",
                color: "bg-green-50 text-green-600"
              },
              {
                icon: <BarChart3 size={24} />,
                title: "Live Analytics",
                desc: "Real-time dashboards to track agent performance and CSAT scores.",
                color: "bg-pink-50 text-pink-600"
              },
              {
                icon: <Globe size={24} />,
                title: "Multilingual",
                desc: "Auto-translate conversations in real-time to support global customers.",
                color: "bg-cyan-50 text-cyan-600"
              }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all group">
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-16">
           <div className="flex-1">
             <h2 className="text-3xl md:text-4xl font-bold mb-6">Connects with your favorite tools</h2>
             <p className="text-indigo-200 text-lg mb-8 leading-relaxed">
               Don't change your stack. ConnectFlo integrates with Shopify, Salesforce, Jira, and 50+ other tools to bring context directly to your agents.
             </p>
             <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-slate-900"><Check size={14} strokeWidth={3}/></div>
                   <span>Two-way data sync</span>
                </li>
                 <li className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-slate-900"><Check size={14} strokeWidth={3}/></div>
                   <span>Trigger workflows from external events</span>
                </li>
                 <li className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-slate-900"><Check size={14} strokeWidth={3}/></div>
                   <span>No-code setup wizard</span>
                </li>
             </ul>
             <button onClick={() => onNavigate('integrations')} className="text-white font-bold border-b border-green-500 pb-1 hover:text-green-400 transition-colors">Explore Integrations &rarr;</button>
           </div>
           <div className="flex-1 relative">
              <div className="grid grid-cols-3 gap-6">
                 {[
                    'shopify', 'salesforce', 'jira', 'slack', 'hubspot', 'zendesk', 'mailchimp', 'intercom', 'notion'
                 ].map((logo, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex items-center justify-center hover:bg-white/20 transition-colors">
                       <img src={`https://cdn.simpleicons.org/${logo}/white`} alt={logo} className="w-10 h-10 opacity-80" />
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 md:p-20 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
          
          <h2 className="text-3xl md:text-5xl font-bold mb-6 relative z-10">Ready to upgrade your support?</h2>
          <p className="text-indigo-100 text-xl mb-10 max-w-2xl mx-auto relative z-10">
            Join 10,000+ support teams delivering faster, happier resolutions with ConnectFlo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button onClick={() => onNavigate('signup')} className="px-8 py-4 bg-white text-indigo-600 rounded-full font-bold text-lg hover:bg-indigo-50 transition-all shadow-lg">
              Get Started for Free
            </button>
            <button className="px-8 py-4 bg-indigo-700 text-white border border-indigo-500 rounded-full font-bold text-lg hover:bg-indigo-800 transition-all">
              Talk to Sales
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2">
             <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-xs">C</div>
                <span className="text-lg font-bold text-slate-900">ConnectFlo</span>
             </div>
             <p className="text-slate-400 text-sm max-w-xs">
               The all-in-one AI customer support platform for modern businesses.
             </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button className="hover:text-indigo-600 text-left" onClick={() => onNavigate('login')}>Inbox</button></li>
              <li><button className="hover:text-indigo-600 text-left" onClick={() => onNavigate('login')}>Workflows</button></li>
              <li><button className="hover:text-indigo-600 text-left" onClick={() => onNavigate('login')}>Reporting</button></li>
              <li><button onClick={() => onNavigate('pricing')} className="hover:text-indigo-600 text-left">Pricing</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button className="hover:text-indigo-600 text-left">About</button></li>
              <li><button className="hover:text-indigo-600 text-left">Careers</button></li>
              <li><button className="hover:text-indigo-600 text-left">Blog</button></li>
              <li><button className="hover:text-indigo-600 text-left">Contact</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button onClick={() => onNavigate('privacy')} className="hover:text-indigo-600 text-left">Privacy</button></li>
              <li><button onClick={() => onNavigate('terms')} className="hover:text-indigo-600 text-left">Terms</button></li>
              <li><button onClick={() => onNavigate('security')} className="hover:text-indigo-600 text-left">Security</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-100 text-center text-slate-400 text-sm">
           &copy; 2025 BroadTekniks LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default WebsiteHome;
