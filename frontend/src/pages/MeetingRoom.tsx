import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { createSocket } from "../services/socket";
import MeetingChat from "../components/MeetingChat";
import MeetingAI from "../components/MeetingAI";
import { useNavigate, useParams } from "react-router-dom";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Copy,
  MonitorUp,
  MonitorOff,
} from "lucide-react";

interface JoinResponse {
  success: boolean;
  message?: string;
  participants?: string[];
}

interface OfferData {
  from: string;
  offer: RTCSessionDescriptionInit;
}

interface AnswerData {
  from: string;
  answer: RTCSessionDescriptionInit;
}

interface IceData {
  from: string;
  candidate: RTCIceCandidateInit;
}

function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
const screenSharingRef = useRef(false);

const [isScreenSharing, setIsScreenSharing] = useState(false);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let socket: Socket | null = null;
    let peer: RTCPeerConnection | null = null;
    let currentRemoteId: string | null = null;
    const pendingCandidates: RTCIceCandidateInit[] = [];

    const closePeer = () => {
      peer?.close();
      peer = null;
      peerRef.current = null;
      currentRemoteId = null;
      pendingCandidates.length = 0;

      remoteStreamRef.current = null;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      if (active) {
        setRemoteConnected(false);
      }
    };

    const createPeer = (remoteId: string) => {
      if (peer && currentRemoteId === remoteId) {
        return peer;
      }

      closePeer();

      currentRemoteId = remoteId;

      const connection = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      });

      peer = connection;
      peerRef.current = connection;

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      streamRef.current?.getTracks().forEach((track) => {
        connection.addTrack(track, streamRef.current!);
      });

      connection.ontrack = (event) => {
        const incomingStream = event.streams[0];

        if (incomingStream) {
          remoteStreamRef.current = incomingStream;

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = incomingStream;
          }
        } else {
          remoteStream.addTrack(event.track);
        }

        setRemoteConnected(true);
      };

      connection.onicecandidate = (event) => {
        if (event.candidate && socket?.connected) {
          socket.emit("ice-candidate", {
            target: remoteId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      connection.onconnectionstatechange = () => {
        if (!active) return;

        if (connection.connectionState === "connected") {
          setConnectionStatus("Video call connected");
        }

        if (connection.connectionState === "failed") {
          setConnectionStatus("Video connection failed");
          setError("Unable to establish video connection.");
        }

        if (connection.connectionState === "disconnected") {
          setConnectionStatus("Participant disconnected");
        }
      };

      return connection;
    };

    const flushCandidates = async () => {
      if (!peer?.remoteDescription) return;

      while (pendingCandidates.length > 0) {
        const candidate = pendingCandidates.shift();

        if (candidate) {
          await peer.addIceCandidate(candidate);
        }
      }
    };

    const initializeMeeting = async () => {
      const token = sessionStorage.getItem("token");

      if (!token || !meetingId) {
        setConnectionStatus("Authentication required");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setCameraOn(stream.getVideoTracks()[0]?.enabled ?? false);
        setMicOn(stream.getAudioTracks()[0]?.enabled ?? false);
      } catch {
        if (active) {
          setCameraOn(false);
          setMicOn(false);
          setError("Camera or microphone unavailable. Joining without media.");
        }
      }

      if (!active) return;

      socket = createSocket(token);
socketRef.current = socket;
setChatSocket(socket);

      socket.on("connect", () => {
        if (!active || !socket) return;

        setConnectionStatus("Connected to server");

        socket.emit(
          "join-room",
          meetingId,
          (response: JoinResponse) => {
            if (!active) return;

            if (response.success) {
              setConnectionStatus("Successfully joined meeting");
            } else {
              setConnectionStatus(
                response.message || "Unable to join meeting"
              );
            }
          }
        );
      });

      socket.on("user-joined", async (data: { socketId: string }) => {
        if (!active || !socket) return;

        try {
          const connection = createPeer(data.socketId);
          const offer = await connection.createOffer();

          await connection.setLocalDescription(offer);

          socket.emit("webrtc-offer", {
            target: data.socketId,
            offer: connection.localDescription?.toJSON(),
          });

          setConnectionStatus("Connecting to participant...");
        } catch (err) {
          console.error("Offer error:", err);
          setError("Failed to initiate video call.");
        }
      });

      socket.on("webrtc-offer", async (data: OfferData) => {
        if (!active || !socket) return;

        try {
          const connection = createPeer(data.from);

          await connection.setRemoteDescription(data.offer);
          await flushCandidates();

          const answer = await connection.createAnswer();

          await connection.setLocalDescription(answer);

          socket.emit("webrtc-answer", {
            target: data.from,
            answer: connection.localDescription?.toJSON(),
          });
        } catch (err) {
          console.error("Answer creation error:", err);
          setError("Failed to answer video call.");
        }
      });

      socket.on("webrtc-answer", async (data: AnswerData) => {
        if (!active || !peer || currentRemoteId !== data.from) return;

        try {
          await peer.setRemoteDescription(data.answer);
          await flushCandidates();
        } catch (err) {
          console.error("Remote answer error:", err);
          setError("Failed to establish video connection.");
        }
      });

      socket.on("ice-candidate", async (data: IceData) => {
        if (!active) return;

        if (currentRemoteId && currentRemoteId !== data.from) {
          return;
        }

        try {
          if (peer?.remoteDescription) {
            await peer.addIceCandidate(data.candidate);
          } else {
            pendingCandidates.push(data.candidate);
          }
        } catch (err) {
          console.error("ICE candidate error:", err);
        }
      });

      socket.on("user-left", (data: { socketId: string }) => {
        if (data.socketId === currentRemoteId) {
          closePeer();
          setConnectionStatus("Participant left the meeting");
        }
      });

      socket.on("connect_error", (err: Error) => {
        if (active) {
          setConnectionStatus(`Connection failed: ${err.message}`);
        }
      });

      socket.on("disconnect", () => {
        closePeer();

        if (active) {
          setConnectionStatus("Disconnected from server");
        }
      });

      socket.connect();
    };

    initializeMeeting();

    return () => {
      active = false;
    screenStreamRef.current?.getTracks().forEach((track) => {
  track.stop();
});

screenStreamRef.current = null;
screenSharingRef.current = false;

      socket?.disconnect();
      setChatSocket(null);

      closePeer();

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
      socketRef.current = null;
    };
  }, [meetingId]);

  const toggleCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  const stopScreenSharing = async () => {
  if (!screenSharingRef.current) return;

  screenSharingRef.current = false;
  setIsScreenSharing(false);

  const cameraTrack = cameraTrackRef.current;

  if (cameraTrack) {
    const sender = peerRef.current
      ?.getSenders()
      .find((item) => item.track?.kind === "video");

    if (sender) {
      try {
        await sender.replaceTrack(cameraTrack);
      } catch (err) {
        console.error("Unable to restore camera:", err);
      }
    }
  }

  screenStreamRef.current?.getTracks().forEach((track) => {
    track.stop();
  });

  screenStreamRef.current = null;

  if (localVideoRef.current && streamRef.current) {
    localVideoRef.current.srcObject = streamRef.current;
  }
};

const startScreenSharing = async () => {
  if (screenSharingRef.current) return;

  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const screenTrack = screenStream.getVideoTracks()[0];

    if (!screenTrack) {
      screenStream.getTracks().forEach((track) => track.stop());
      return;
    }

    const sender = peerRef.current
      ?.getSenders()
      .find((item) => item.track?.kind === "video");

    if (!sender) {
      screenStream.getTracks().forEach((track) => track.stop());
      setError("Join a video call before sharing your screen.");
      return;
    }

    cameraTrackRef.current =
      streamRef.current?.getVideoTracks()[0] || null;

    await sender.replaceTrack(screenTrack);

    screenStreamRef.current = screenStream;
    screenSharingRef.current = true;
    setIsScreenSharing(true);
    setError("");

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = screenStream;
    }

    screenTrack.onended = () => {
      void stopScreenSharing();
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      return;
    }

    console.error("Screen sharing error:", err);
    setError("Unable to start screen sharing.");
  }
};

const leaveMeeting = () => {
  screenStreamRef.current?.getTracks().forEach((track) => {
    track.stop();
  });

  screenStreamRef.current = null;
  screenSharingRef.current = false;

  socketRef.current?.disconnect();

  peerRef.current?.close();

  streamRef.current?.getTracks().forEach((track) => {
    track.stop();
  });

  navigate("/dashboard");
};

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Meeting link copied!");
    } catch {
      setError("Unable to copy meeting link.");
    }
  };

  return (
    <div className="meeting-room">
      <header className="room-header">
        <div className="room-brand">
          <Video size={26} />
          <h2>IntellMeet</h2>
        </div>

        <div className="room-info">
          <span>Meeting ID: {meetingId}</span>

          <button onClick={copyLink}>
            <Copy size={18} />
            Copy Link
          </button>
        </div>
      </header>

      <div className="connection-status">
        <span
          className="status-dot"
          style={{
            background: connectionStatus === "Video call connected"
              ? "#22c55e"
              : "#f59e0b",
          }}
        />
        {connectionStatus}
      </div>

      <main className="video-area">
        <div className="video-container">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
          />

          {!cameraOn && (
            <div className="camera-off">
              <VideoOff size={48} />
              <p>Camera is off</p>
            </div>
          )}

          <div className="video-label">You</div>
        </div>

        <div className="video-container">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
          />

          {!remoteConnected && (
            <div className="participants-placeholder">
              <Users size={42} />
              <h3>Waiting for Participant</h3>
              <p>The other participant's video will appear here.</p>
            </div>
          )}

          <div className="video-label">Participant</div>
        </div>
      </main>
     <MeetingChat
  socket={chatSocket}
  meetingId={meetingId || ""}
/>
<MeetingAI meetingId={meetingId || ""} />

      {error && <p className="room-error">{error}</p>}

      <footer className="meeting-controls">
        <button
          onClick={toggleMic}
          className={!micOn ? "control-off" : ""}
          title={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic /> : <MicOff />}
        </button>

        <button
          onClick={toggleCamera}
          className={!cameraOn ? "control-off" : ""}
          title={cameraOn ? "Turn off camera" : "Turn on camera"}
        >
          {cameraOn ? <Video /> : <VideoOff />}
        </button>
        <button
  onClick={() => {
    if (isScreenSharing) {
      void stopScreenSharing();
    } else {
      void startScreenSharing();
    }
  }}
  className={isScreenSharing ? "screen-sharing-active" : ""}
  title={isScreenSharing ? "Stop screen sharing" : "Share screen"}
  aria-label={isScreenSharing ? "Stop screen sharing" : "Share screen"}
>
  {isScreenSharing ? <MonitorOff /> : <MonitorUp />}
</button>

        <button className="leave-btn" onClick={leaveMeeting}>
          <PhoneOff />
          Leave
        </button>
      </footer>
    </div>
  );
}

export default MeetingRoom;