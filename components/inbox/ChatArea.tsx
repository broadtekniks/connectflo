import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
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
  Archive,
  Trash2,
} from "lucide-react";
import {
  Conversation,
  Message,
  MessageSender,
  ChannelType,
  User,
} from "../../types";
import { api } from "../../services/api";

interface ChatAreaProps {
  conversation: Conversation;
  currentUser: User | null;
  onSendMessage: (text: string, isPrivate: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  currentUser,
  onSendMessage,
  onArchive,
  onDelete,
}) => {
  const [input, setInput] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [voicemailAudio, setVoicemailAudio] = useState<Record<string, string>>(
    {}
  );
  const [voicemailLoading, setVoicemailLoading] = useState<
    Record<string, boolean>
  >({});
  const [voicemailError, setVoicemailError] = useState<Record<string, string>>(
    {}
  );

  // Check if this is a callback request (notification-only, no reply interface)
  const isCallbackRequest = conversation.tags?.includes("callback-requested");

  const isVoicemailMessage = (msg: Message) => {
    return (
      conversation.channel === ChannelType.VOICE &&
      msg.sender === MessageSender.CUSTOMER &&
      Array.isArray(msg.attachments) &&
      msg.attachments.length > 0
    );
  };

  const stripRecordingUrl = (text: string) => {
    return String(text || "")
      .replace(/\s*Recording:\s*https?:\/\/\S+/gi, "")
      .trim();
  };

  const loadVoicemailAudio = async (messageId: string) => {
    if (!messageId) return;
    if (voicemailAudio[messageId] || voicemailLoading[messageId]) return;

    setVoicemailLoading((prev) => ({ ...prev, [messageId]: true }));
    setVoicemailError((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });

    try {
      const blob = await api.getBlob(`/voicemails/${messageId}/audio`);
      const objectUrl = URL.createObjectURL(blob);
      setVoicemailAudio((prev) => ({ ...prev, [messageId]: objectUrl }));
    } catch (err: any) {
      setVoicemailError((prev) => ({
        ...prev,
        [messageId]: err?.message || "Failed to load voicemail audio",
      }));
    } finally {
      setVoicemailLoading((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    setAiSuggestion(null);
  }, [conversation.messages]);

  useEffect(() => {
    // Cleanup audio object URLs when switching conversations.
    return () => {
      Object.values(voicemailAudio).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const handleGenerateAi = async () => {
    setIsGenerating(true);
    try {
      const context = `Agent Name: ${
        currentUser?.name || "Agent"
      }, Customer Name: ${conversation.customer.name}, Email: ${
        conversation.customer.email
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
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"
          >
            <MoreHorizontal size={20} />
          </button>

          {showMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
              <button
                onClick={() => {
                  onArchive(conversation.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Archive size={16} />
                Archive Chat
              </button>
              <button
                onClick={() => {
                  onDelete(conversation.id);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete Chat
              </button>
            </div>
          )}
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
              const isVoicemail = isVoicemailMessage(msg);
              const displayContent = isVoicemail
                ? stripRecordingUrl(msg.content)
                : msg.content;

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
                        <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:mt-3 prose-headings:mb-2">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0">{children}</p>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc ml-4 space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal ml-4 space-y-1">
                                  {children}
                                </ol>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-bold">
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em className="italic">{children}</em>
                              ),
                            }}
                          >
                            {displayContent}
                          </ReactMarkdown>
                        </div>

                        {isVoicemail && (
                          <div className="mt-3">
                            {voicemailAudio[msg.id] ? (
                              <div
                                className={`rounded-lg border px-3 py-2 ${
                                  isMe
                                    ? "bg-slate-50 border-slate-200"
                                    : "bg-white/10 border-white/20"
                                }`}
                              >
                                <div
                                  className={`mb-2 text-[10px] font-bold uppercase tracking-wide ${
                                    isMe ? "text-slate-500" : "text-white/80"
                                  }`}
                                >
                                  Voicemail
                                </div>
                                <audio
                                  controls
                                  preload="none"
                                  className="w-full"
                                  src={voicemailAudio[msg.id]}
                                />
                              </div>
                            ) : (
                              <div
                                className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-3 ${
                                  isMe
                                    ? "bg-slate-50 border-slate-200"
                                    : "bg-white/10 border-white/20"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div
                                    className={`text-xs font-semibold ${
                                      isMe ? "text-slate-700" : "text-white"
                                    }`}
                                  >
                                    Voicemail recording
                                  </div>
                                  {voicemailError[msg.id] ? (
                                    <div
                                      className={`mt-0.5 text-[11px] ${
                                        isMe ? "text-red-600" : "text-rose-200"
                                      }`}
                                    >
                                      {voicemailError[msg.id]}
                                    </div>
                                  ) : (
                                    <div
                                      className={`mt-0.5 text-[11px] ${
                                        isMe
                                          ? "text-slate-500"
                                          : "text-white/70"
                                      }`}
                                    >
                                      Click to load audio
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => loadVoicemailAudio(msg.id)}
                                  disabled={Boolean(voicemailLoading[msg.id])}
                                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                                    isMe
                                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                      : "bg-white text-indigo-700 hover:bg-indigo-50"
                                  }`}
                                >
                                  {voicemailLoading[msg.id]
                                    ? "Loading…"
                                    : "Listen"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
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

          {/* Input Area - Hide for callback requests, show action banner instead */}
          {isCallbackRequest ? (
            <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                  <PhoneOff size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-indigo-900 mb-1">
                    Callback Required
                  </h3>
                  <p className="text-sm text-indigo-700">
                    This customer requested a callback. Please call them at the
                    number provided above.
                  </p>
                </div>
                <button
                  onClick={() => onArchive(conversation.id)}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                >
                  Mark as Contacted
                </button>
              </div>
            </div>
          ) : (
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
          )}
        </>
      )}
    </div>
  );
};

export default ChatArea;
