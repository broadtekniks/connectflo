import React, { useState, useEffect, useRef } from "react";
import { Send, MessageSquare, User } from "lucide-react";
import { api } from "../services/api";
import { socketService } from "../services/socket";
import { Message, Conversation } from "../types";

const TestChat: React.FC = () => {
  const [customer, setCustomer] = useState<any>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [chatMode, setChatMode] = useState<"SIMULATED" | "SELF">("SIMULATED");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startChat = async (mode: "SIMULATED" | "SELF") => {
    setLoading(true);
    setChatMode(mode);
    try {
      // Get current tenant ID from logged in admin
      const adminUserStr = localStorage.getItem("user");
      const adminToken = localStorage.getItem("token");

      if (!adminUserStr || !adminToken) return;
      const adminUser = JSON.parse(adminUserStr);

      let targetUser = adminUser;
      let targetToken = adminToken;

      if (mode === "SIMULATED") {
        // Create or get test customer
        const { user, token } = await api.tenants.createTestCustomer(
          adminUser.tenantId
        );
        targetUser = user;
        targetToken = token;
      }

      setCustomer(targetUser);
      setCustomerToken(targetToken);

      // Create a helper to fetch with customer token
      const fetchWithToken = async (url: string, options: RequestInit = {}) => {
        return fetch(`http://localhost:3002/api${url}`, {
          ...options,
          headers: {
            ...options.headers,
            "Content-Type": "application/json",
            Authorization: `Bearer ${targetToken}`,
          },
        }).then((res) => res.json());
      };

      const newConv = await fetchWithToken("/conversations", {
        method: "POST",
        body: JSON.stringify({
          customerId: targetUser.id,
          channel: "CHAT",
          subject:
            mode === "SELF" ? "Chat from Admin" : "Test Chat from Admin Panel",
          initialMessage: "Hello, I need help!",
        }),
      });

      setConversation(newConv);
      setMessages(newConv.messages || []);
      setIsStarted(true);
    } catch (error) {
      console.error("Failed to init chat", error);
    } finally {
      setLoading(false);
    }
  };

  // Poll for new messages (since we can't easily use the single socket instance for a different user)
  useEffect(() => {
    if (!conversation || !customerToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `http://localhost:3002/api/conversations/${conversation.id}`,
          {
            headers: { Authorization: `Bearer ${customerToken}` },
          }
        );
        const data = await res.json();
        if (data && data.messages) {
          setMessages(data.messages);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [conversation, customerToken]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation || !customerToken) return;

    try {
      const content = newMessage;
      setNewMessage("");

      // Optimistic update
      const tempMsg: any = {
        id: Date.now().toString(),
        content,
        sender: "CUSTOMER",
        createdAt: new Date().toISOString(),
        isPrivateNote: false,
        attachments: [],
      };
      setMessages((prev) => [...prev, tempMsg]);

      await fetch(`http://localhost:3002/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          content,
          sender: "CUSTOMER",
        }),
      });
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  if (!isStarted) {
    return (
      <div className="flex flex-col h-full bg-slate-50 items-center justify-center p-8">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Test Chat Widget
          </h1>
          <p className="text-slate-500 mb-8">
            Simulate a customer conversation to test your AI agent and routing
            rules.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => startChat("SIMULATED")}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Initializing..." : "Simulate New Customer"}
            </button>
            <button
              onClick={() => startChat("SELF")}
              disabled={loading}
              className="w-full bg-white text-indigo-600 border border-indigo-200 py-3 rounded-lg font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Initializing..." : "Chat as Myself (Admin)"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="text-indigo-600" />
            Test Chat Widget
          </h1>
          <p className="text-sm text-slate-500">
            {chatMode === "SIMULATED"
              ? "Simulating customer: "
              : "Chatting as: "}
            <span className="font-medium text-slate-700">{customer?.name}</span>{" "}
            ({customer?.email})
          </p>
        </div>
        <div className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
          {chatMode === "SIMULATED" ? "Simulation Mode" : "Admin Chat Mode"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "CUSTOMER" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.sender === "CUSTOMER"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    msg.sender === "CUSTOMER"
                      ? "text-indigo-200"
                      : "text-slate-400"
                  }`}
                >
                  {new Date(msg.timestamp || Date.now()).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 p-4">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message as the customer..."
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-2">
            Messages sent here will appear in your Inbox. Open Inbox in a new
            tab to reply.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestChat;
