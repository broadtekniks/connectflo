import React, { useState } from "react";
import {
  Search,
  Filter,
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import {
  Conversation,
  ChannelType,
  ConversationStatus,
  User,
} from "../../types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUser: User | null;
}

const getChannelIcon = (channel: ChannelType) => {
  switch (channel) {
    case ChannelType.VOICE:
      return <Phone size={14} className="text-purple-500" />;
    case ChannelType.EMAIL:
      return <Mail size={14} className="text-blue-500" />;
    case ChannelType.SMS:
      return <MessageSquare size={14} className="text-green-500" />;
    default:
      return <MessageCircle size={14} className="text-indigo-500" />;
  }
};

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  currentUser,
}) => {
  const [filter, setFilter] = useState<
    "all" | "mine" | "unassigned" | "archived"
  >("all");

  const filteredConversations = conversations.filter((conv) => {
    // Handle archived view
    if (filter === "archived") {
      return conv.status === ConversationStatus.RESOLVED;
    }

    // Exclude resolved conversations from other views
    if (conv.status === ConversationStatus.RESOLVED) return false;

    if (filter === "mine") {
      return currentUser && conv.assignee?.id === currentUser.id;
    }
    if (filter === "unassigned") {
      return !conv.assignee;
    }
    // 'all' includes all non-resolved conversations
    return true;
  });

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Inbox</h2>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-2.5 top-2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="p-2 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600">
            <Filter size={16} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
              filter === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Open
          </button>
          <button
            onClick={() => setFilter("mine")}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
              filter === "mine"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Mine
          </button>
          <button
            onClick={() => setFilter("unassigned")}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
              filter === "unassigned"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Unassigned
          </button>
          <button
            onClick={() => setFilter("archived")}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
              filter === "archived"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((conv) => {
          const lastMsg = conv.messages[conv.messages.length - 1];
          const isSelected = conv.id === selectedId;

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${
                isSelected
                  ? "bg-indigo-50 border-l-4 border-l-indigo-500"
                  : "border-l-4 border-l-transparent"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                    <img
                      src={conv.customer.avatar}
                      alt={conv.customer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className={`font-semibold text-sm truncate ${
                      isSelected ? "text-indigo-900" : "text-slate-800"
                    }`}
                  >
                    {conv.customer.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(conv.lastActivity).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                {getChannelIcon(conv.channel)}
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {conv.channel}
                </span>
                {conv.isVoiceActive && (
                  <span className="flex items-center gap-1 text-xs text-red-500 font-bold animate-pulse">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    LIVE
                  </span>
                )}
              </div>
              <p
                className={`text-sm line-clamp-2 ${
                  lastMsg.sender === "CUSTOMER"
                    ? "font-medium text-slate-700"
                    : "text-slate-500"
                }`}
              >
                {conv.subject ? (
                  <span className="font-bold">{conv.subject}: </span>
                ) : null}
                {lastMsg.content}
              </p>
              <div className="flex gap-1 mt-2">
                {conv.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded border border-slate-200 uppercase"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;
