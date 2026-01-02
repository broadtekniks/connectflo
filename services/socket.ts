import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3002";

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    this.socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: true,
      auth: { token },
    });

    this.socket.on("connect", () => {
      console.log("Socket connected:", this.socket?.id);
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit("join_conversation", conversationId);
    }
  }

  onNewMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on("new_message", callback);
    }
  }

  offNewMessage() {
    if (this.socket) {
      this.socket.off("new_message");
    }
  }

  onTeamMemberCheckinUpdated(
    callback: (payload: {
      userId: string;
      tenantId: string;
      isCheckedIn: boolean;
      checkedInAt: string | null;
    }) => void
  ) {
    if (this.socket) {
      this.socket.on("team_member_checkin_updated", callback);
    }
  }

  offTeamMemberCheckinUpdated() {
    if (this.socket) {
      this.socket.off("team_member_checkin_updated");
    }
  }
}

export const socketService = new SocketService();
