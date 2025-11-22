import React, { useState, useEffect } from "react";
import ConversationList from "../components/inbox/ConversationList";
import ChatArea from "../components/inbox/ChatArea";
import CustomerPanel from "../components/inbox/CustomerPanel";
import { CURRENT_USER } from "../constants";
import { MessageSender, Message, Conversation } from "../types";
import { api } from "../services/api";
import { socketService } from "../services/socket";

const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socketService.connect();

    socketService.onNewMessage((message: Message) => {
      setConversations((prev) =>
        prev.map((c) => {
          // Update if it's the correct conversation
          if (c.id === message.conversationId) {
            // Avoid duplicates (if added via optimistic UI or API response)
            if (c.messages.some((m) => m.id === message.id)) {
              return c;
            }
            return {
              ...c,
              messages: [...c.messages, message],
              lastActivity: message.timestamp,
            };
          }
          return c;
        })
      );
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedId) {
      socketService.joinConversation(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await api.conversations.list();
        setConversations(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const handleSendMessage = async (text: string, isPrivate: boolean) => {
    if (!selectedId) return;

    try {
      await api.messages.send(selectedId, text, MessageSender.AGENT, isPrivate);

      // State update is handled by the socket event listener to avoid duplicates
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">Loading...</div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selectedConversation ? (
        <>
          <ChatArea
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
          />
          <CustomerPanel conversation={selectedConversation} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          Select a conversation to start chatting
        </div>
      )}
    </div>
  );
};

export default Inbox;
