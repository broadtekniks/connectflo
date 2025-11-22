import React from 'react';
import { LayoutDashboard, Inbox, Settings, Users, BookOpen, Workflow, Blocks, Phone } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'phone-numbers', label: 'Phone Numbers', icon: Phone },
    { id: 'workflows', label: 'Workflows', icon: Workflow },
    { id: 'integrations', label: 'Integrations', icon: Blocks },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-16 lg:w-64 bg-slate-900 text-white flex flex-col h-full transition-all duration-300 border-r border-slate-800 shrink-0">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800 cursor-pointer" onClick={() => onNavigate('dashboard')}>
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
           <span className="font-bold text-white">C</span>
        </div>
        <span className="ml-3 font-bold text-lg hidden lg:block">ConnectFlo</span>
      </div>

      <nav className="flex-1 py-6 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center px-3 lg:px-6 py-3 transition-colors duration-200 ${
              currentView === item.id
                ? 'bg-indigo-600 text-white border-r-4 border-indigo-300'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <item.icon size={20} className="shrink-0" />
            <span className="ml-3 font-medium hidden lg:block">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-center lg:justify-start cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onNavigate('settings')}>
            <img 
                src="https://picsum.photos/id/1005/40/40" 
                alt="User" 
                className="w-8 h-8 rounded-full border border-slate-600"
            />
             <div className="ml-3 hidden lg:block overflow-hidden">
                <p className="text-sm font-medium text-white truncate">Sarah Jenkins</p>
                <p className="text-xs text-slate-400 truncate">Agent</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;