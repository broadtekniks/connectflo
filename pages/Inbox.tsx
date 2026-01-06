import React, { useState, useEffect } from "react";
import ConversationList from "../components/inbox/ConversationList";
import ChatArea from "../components/inbox/ChatArea";
import CustomerPanel from "../components/inbox/CustomerPanel";
import ConfirmationModal from "../components/ConfirmationModal";
import {
  MessageSender,
  Message,
  Conversation,
  User,
  ConversationStatus,
} from "../types";
import { api } from "../services/api";
import { socketService } from "../services/socket";

const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "ARCHIVE" | "DELETE";
    id: string;
  } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

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

      // Fetch full conversation history
      api.conversations
        .get(selectedId)
        .then((fullConv) => {
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedId ? fullConv : c))
          );
        })
        .catch((err) =>
          console.error("Failed to fetch full conversation", err)
        );
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

  const refreshConversations = async () => {
    const data = await api.conversations.list();
    setConversations(data);
    return data;
  };

  const handleCheckAssignments = async () => {
    if (!currentUser || currentUser.role !== "AGENT") return;

    setClaiming(true);
    setClaimMessage(null);

    try {
      const result = await api.conversations.claimNext();
      const claimed = result?.claimed;

      if (!claimed) {
        setClaimMessage("No unassigned chats/calls available.");
        await refreshConversations();
        return;
      }

      setClaimMessage("Assigned a new conversation.");
      await refreshConversations();
      setSelectedId(claimed.id);
    } catch (error) {
      console.error("Failed to claim next conversation:", error);
      setClaimMessage(
        error instanceof Error ? error.message : "Failed to check assignments"
      );
    } finally {
      setClaiming(false);
    }
  };

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

  const executeAction = async () => {
    if (!confirmAction) return;

    const { type, id } = confirmAction;

    try {
      if (type === "ARCHIVE") {
        await api.conversations.update(id, {
          status: ConversationStatus.RESOLVED,
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: ConversationStatus.RESOLVED } : c
          )
        );
      } else {
        await api.conversations.delete(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }

      if (selectedId === id) setSelectedId(null);
    } catch (error) {
      console.error(`Failed to ${type.toLowerCase()} conversation:`, error);
    } finally {
      setConfirmAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          currentUser={currentUser}
          onCheckAssignments={handleCheckAssignments}
          checkingAssignments={claiming}
          checkAssignmentsMessage={claimMessage}
        />
        {selectedConversation ? (
          <>
            <ChatArea
              conversation={selectedConversation}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onArchive={(id) => setConfirmAction({ type: "ARCHIVE", id })}
              onDelete={(id) => setConfirmAction({ type: "DELETE", id })}
            />
            <CustomerPanel conversation={selectedConversation} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Select a conversation to start chatting
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!confirmAction}
        title={
          confirmAction?.type === "DELETE"
            ? "Delete Conversation"
            : "Archive Conversation"
        }
        message={
          confirmAction?.type === "DELETE"
            ? "Are you sure you want to permanently delete this conversation? This action cannot be undone."
            : "Are you sure you want to archive this conversation? It will be moved to the resolved list."
        }
        confirmLabel={confirmAction?.type === "DELETE" ? "Delete" : "Archive"}
        isDestructive={confirmAction?.type === "DELETE"}
        onConfirm={executeAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default Inbox;
