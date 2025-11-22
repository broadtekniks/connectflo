import React from 'react';
import { User as UserIcon, Mail, Phone, Clock, MapPin, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { Conversation, Sentiment } from '../../types';

interface CustomerPanelProps {
  conversation: Conversation;
}

const CustomerPanel: React.FC<CustomerPanelProps> = ({ conversation }) => {
  const { customer } = conversation;

  return (
    <div className="w-80 bg-white border-l border-slate-200 h-full flex flex-col shrink-0 overflow-y-auto">
      {/* Profile Header */}
      <div className="p-6 border-b border-slate-100 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 mb-4 border-4 border-white shadow-sm overflow-hidden">
            <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{customer.name}</h2>
        <div className="flex items-center justify-center gap-1 text-slate-500 text-sm mt-1">
            <MapPin size={12} />
            <span>San Francisco, CA</span>
        </div>
        
        <div className="flex justify-center gap-3 mt-4">
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                <Mail size={16} />
            </button>
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                <Phone size={16} />
            </button>
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-full text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                <ExternalLink size={16} />
            </button>
        </div>
      </div>

      {/* AI Sentiment Analysis */}
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Sentiment</h3>
        <div className={`flex items-center p-3 rounded-lg border ${
            conversation.sentiment === Sentiment.NEGATIVE 
            ? 'bg-red-50 border-red-100 text-red-700' 
            : conversation.sentiment === Sentiment.POSITIVE 
            ? 'bg-green-50 border-green-100 text-green-700' 
            : 'bg-slate-50 border-slate-100 text-slate-600'
        }`}>
            {conversation.sentiment === Sentiment.NEGATIVE ? <AlertCircle size={20} className="mr-3" /> : <CheckCircle size={20} className="mr-3" />}
            <div>
                <span className="block font-bold text-sm">{conversation.sentiment}</span>
                <span className="text-xs opacity-80">
                    {conversation.sentiment === Sentiment.NEGATIVE ? 'Customer seems frustrated. Propose a discount.' : 'Conversation is going smoothly.'}
                </span>
            </div>
        </div>
      </div>

      {/* Info List */}
      <div className="p-6 space-y-4">
         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Details</h3>
         
         <div className="flex items-center justify-between text-sm">
             <span className="text-slate-500">Email</span>
             <span className="text-slate-800 font-medium truncate max-w-[140px]">{customer.email}</span>
         </div>
         <div className="flex items-center justify-between text-sm">
             <span className="text-slate-500">Customer Since</span>
             <span className="text-slate-800 font-medium">Oct 2023</span>
         </div>
         <div className="flex items-center justify-between text-sm">
             <span className="text-slate-500">LTV</span>
             <span className="text-slate-800 font-medium">$1,240.00</span>
         </div>
          <div className="flex items-center justify-between text-sm">
             <span className="text-slate-500">Plan</span>
             <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">PRO</span>
         </div>
      </div>

       {/* Recent Tickets */}
      <div className="p-6 border-t border-slate-100">
         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent History</h3>
         <div className="space-y-3">
            <div className="flex gap-3 items-start">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-green-400 shrink-0"></div>
                <div>
                    <p className="text-xs text-slate-800 font-medium leading-tight hover:text-indigo-600 cursor-pointer">Unable to reset password</p>
                    <span className="text-[10px] text-slate-400">2 days ago • Solved</span>
                </div>
            </div>
            <div className="flex gap-3 items-start">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-green-400 shrink-0"></div>
                <div>
                    <p className="text-xs text-slate-800 font-medium leading-tight hover:text-indigo-600 cursor-pointer">Pricing inquiry for Enterprise</p>
                    <span className="text-[10px] text-slate-400">1 month ago • Solved</span>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default CustomerPanel;
