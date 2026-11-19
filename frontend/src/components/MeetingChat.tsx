import { useEffect, useState, type FormEvent } from "react";
import type { Socket } from "socket.io-client";
import axios from "axios";
import { Send, MessageSquare } from "lucide-react";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
}

interface MeetingChatProps {
  socket: Socket | null;
  meetingId: string;
}

function MeetingChat({ socket, meetingId }: MeetingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem("token");

    setMessages([]);
    setLoading(true);
    setError("");

    const fetchMessages = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/messages/${meetingId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (active) {
          setMessages((previous) => {
            const combined = [...response.data.messages, ...previous];

            const unique = Array.from(
              new Map(
                combined.map((item: ChatMessage) => [item.id, item])
              ).values()
            );

            return unique.sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            );
          });
        }
      } catch (err) {
        if (active) {
          if (axios.isAxiosError(err)) {
            setError(
              err.response?.data?.message || "Unable to load chat history"
            );
          } else {
            setError("Unable to load chat history");
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchMessages();

    return () => {
      active = false;
    };
  }, [meetingId]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: ChatMessage) => {
      setMessages((previous) => {
        if (previous.some((item) => item.id === data.id)) {
          return previous;
        }

        return [...previous, data];
      });
    };

    socket.on("receive-message", handleMessage);

    return () => {
      socket.off("receive-message", handleMessage);
    };
  }, [socket]);

  const sendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!socket?.connected || !message.trim()) {
      setError("Connect to the meeting before sending messages.");
      return;
    }

    setError("");

    socket.emit(
      "send-message",
      {
        message: message.trim(),
      },
      (response: { success: boolean; message?: string }) => {
        if (response.success) {
          setMessage("");
        } else {
          setError(response.message || "Unable to send message.");
        }
      }
    );
  };

  return (
    <div className="meeting-chat">
      <div className="chat-header">
        <MessageSquare size={20} />
        <h3>Meeting Chat</h3>
      </div>

      <div className="chat-messages">
        {loading ? (
          <p className="chat-empty">Loading chat history...</p>
        ) : messages.length === 0 ? (
          <p className="chat-empty">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((item) => (
            <div className="chat-message" key={item.id}>
              <div className="chat-message-info">
                <strong>{item.senderName}</strong>

                <span>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <p>{item.message}</p>
            </div>
          ))
        )}
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form className="chat-input-area" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          required
        />

        <button type="submit">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

export default MeetingChat;