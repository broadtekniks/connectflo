import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  MoreHorizontal,
  PhoneOff,
  FileText,
  Sparkles,
  Lock,
} from "lucide-react";
import { Conversation, Message, MessageSender, ChannelType } from "../../types";
import { api } from "../../services/api";

interface ChatAreaProps {
  conversation: Conversation;
  onSendMessage: (text: string, isPrivate: boolean) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({ conversation, onSendMessage }) => {
  const [input, setInput] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    setAiSuggestion(null);
  }, [conversation.messages]);

  const handleGenerateAi = async () => {
    setIsGenerating(true);
    try {
      const context = `Customer Name: ${
        conversation.customer.name
      }, Tags: ${conversation.tags.join(", ")}`;
      const aiMessages = conversation.messages.map((m) => ({
        role:
          m.sender === MessageSender.AGENT || m.sender === MessageSender.AI
            ? "assistant"
            : "user",
        content: m.content,
      }));

      const suggestion = await api.ai.generateResponse(aiMessages, context);
      setAiSuggestion(suggestion);
    } catch (error) {
      console.error("Failed to generate AI suggestion:", error);
      setAiSuggestion(
        "Error: Could not reach AI service. Please ensure backend is running on port 3002."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const applySuggestion = () => {
    if (aiSuggestion) {
      setInput(aiSuggestion);
      setAiSuggestion(null);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input, isPrivate);
    setInput("");
  };

  const isVoice =
    conversation.channel === ChannelType.VOICE && conversation.isVoiceActive;

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden relative">
      {/* Header */}
      <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-slate-800 text-lg">
            {conversation.customer.name}
          </h3>
          {conversation.channel === ChannelType.EMAIL &&
            conversation.subject && (
              <span className="text-sm text-slate-500 truncate max-w-md border-l border-slate-300 pl-3">
                {conversation.subject}
              </span>
            )}
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md">
            <MoreHorizontal size={20} />
          </button>
          {isVoice && (
            <button className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md font-medium border border-red-200 transition-colors">
              <PhoneOff size={16} />
              End Call
            </button>
          )}
        </div>
      </div>

      {/* Active Voice Interface Overlay or Standard Chat */}
      {isVoice ? (
        <div className="flex-1 bg-slate-900 text-slate-200 p-8 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-mono text-red-400 tracking-widest uppercase">
                Recording & Transcribing
              </span>
            </div>
            <div className="text-slate-400 font-mono">05:23</div>
          </div>

          <div className="flex-1 space-y-6">
            {conversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${
                  msg.sender === MessageSender.CUSTOMER
                    ? "opacity-100"
                    : "opacity-60"
                }`}
              >
                <div
                  className={`font-bold uppercase text-xs w-20 shrink-0 pt-1 text-right ${
                    msg.sender === MessageSender.CUSTOMER
                      ? "text-blue-400"
                      : "text-purple-400"
                  }`}
                >
                  {msg.sender}
                </div>
                <p className="text-lg font-light leading-relaxed">
                  {msg.content}
                </p>
              </div>
            ))}
            <div className="flex gap-4 opacity-50">
              <div className="font-bold uppercase text-xs w-20 shrink-0 pt-1 text-right text-blue-400">
                CUSTOMER
              </div>
              <div className="flex items-end gap-1 h-6">
                <div
                  className="w-1 bg-blue-400 waveform-bar"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-1 bg-blue-400 waveform-bar"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-1 bg-blue-400 waveform-bar"
                  style={{ animationDelay: "0.3s" }}
                ></div>
              </div>
            </div>
          </div>

          {/* Voice AI Hints */}
          <div className="mt-8 border-t border-slate-700 pt-4">
            <div className="flex items-center gap-2 text-indigo-400 mb-2 font-medium">
              <Sparkles size={16} />
              <span>AI Live Assist</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 p-3 rounded border border-slate-700 hover:border-indigo-500 cursor-pointer transition-colors">
                <h4 className="text-sm font-bold text-white mb-1">
                  Check Refund Policy
                </h4>
                <p className="text-xs text-slate-400">
                  Suggest 30-day return window.
                </p>
              </div>
              <div className="bg-slate-800 p-3 rounded border border-slate-700 hover:border-indigo-500 cursor-pointer transition-colors">
                <h4 className="text-sm font-bold text-white mb-1">
                  Verify Invoice
                </h4>
                <p className="text-xs text-slate-400">
                  Ask for Invoice # to confirm overcharge.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Chat Messages */}
          <div
            className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50"
            ref={scrollRef}
          >
            {conversation.messages.map((msg) => {
              const isMe = msg.sender === MessageSender.AGENT;
              const isAI = msg.sender === MessageSender.AI;
              const isSystem = msg.sender === MessageSender.SYSTEM;

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-4">
                    <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isMe ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[80%] ${
                      isMe ? "flex-row-reverse" : "flex-row"
                    } gap-3`}
                  >
                    {!isMe && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs border-2 border-white shadow-sm ${
                          isAI ? "bg-indigo-600" : "bg-slate-400"
                        }`}
                      >
                        {isAI ? (
                          <Sparkles size={14} />
                        ) : conversation.customer.avatar ? (
                          <img
                            src={conversation.customer.avatar}
                            className="w-full h-full rounded-full object-cover"
                            alt=""
                          />
                        ) : (
                          "U"
                        )}
                      </div>
                    )}
                    <div>
                      <div
                        className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed relative group ${
                          isMe
                            ? msg.isPrivateNote
                              ? "bg-amber-50 border border-amber-200 text-amber-900"
                              : "bg-white border border-slate-200 text-slate-800 rounded-tr-none"
                            : isAI
                            ? "bg-indigo-50 border border-indigo-100 text-slate-800"
                            : "bg-indigo-600 text-white rounded-tl-none"
                        }`}
                      >
                        {msg.isPrivateNote && (
                          <div className="flex items-center gap-1 text-amber-600 text-[10px] font-bold uppercase mb-1">
                            <Lock size={10} /> Private Note
                          </div>
                        )}
                        {msg.content}
                        {isAI && (
                          <div className="absolute -top-2 -right-2 bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold border border-indigo-200 shadow-sm">
                            AI
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block px-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Suggested Reply (AI) */}
          {aiSuggestion && (
            <div className="px-6 py-3 bg-indigo-50 border-t border-indigo-100 flex items-start gap-3 animate-fade-in">
              <div className="p-1.5 bg-indigo-100 rounded-full text-indigo-600 shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-indigo-900 mb-2 font-medium">
                  AI Suggested Reply:
                </p>
                <p className="text-sm text-slate-600 bg-white p-3 rounded border border-indigo-100 shadow-sm mb-2 italic">
                  "{aiSuggestion}"
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={applySuggestion}
                    className="text-xs font-semibold text-white bg-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors"
                  >
                    Apply Suggestion
                  </button>
                  <button
                    onClick={() => setAiSuggestion(null)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="flex gap-4 mb-2">
              <button
                onClick={() => setIsPrivate(false)}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                  !isPrivate
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Reply
              </button>
              <button
                onClick={() => setIsPrivate(true)}
                className={`flex items-center gap-1 text-sm font-medium pb-2 border-b-2 transition-colors ${
                  isPrivate
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Lock size={12} /> Private Note
              </button>
            </div>
            <div
              className={`relative rounded-xl border transition-all focus-within:ring-2 focus-within:ring-offset-1 ${
                isPrivate
                  ? "bg-amber-50 border-amber-200 focus-within:ring-amber-400"
                  : "bg-white border-slate-300 focus-within:ring-indigo-500"
              }`}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isPrivate
                    ? "Write a private note only visible to your team..."
                    : "Write a reply..."
                }
                className={`w-full p-3 bg-transparent resize-none outline-none min-h-[80px] text-sm ${
                  isPrivate
                    ? "placeholder-amber-400/70"
                    : "placeholder-slate-400"
                }`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1">
                  <button className="p-2 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100">
                    <Smile size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100">
                    <Paperclip size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100">
                    <FileText size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateAi}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
                  >
                    <Sparkles size={14} />
                    {isGenerating ? "Thinking..." : "AI Assist"}
                  </button>
                  <button
                    onClick={handleSend}
                    className={`p-2 rounded-md text-white shadow-sm transition-colors ${
                      isPrivate
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatArea;
