const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const messageRoutes = require("./routes/messageRoutes");
const aiRoutes = require("./routes/aiRoutes");

const Meeting = require("./models/Meeting");
const User = require("./models/User");
const Message = require("./models/Message");

dotenv.config();

const app = express();
const server = http.createServer(app);

const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: frontendURL }));
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to IntellMeet Backend!");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "IntellMeet Backend is running successfully!",
  });
});

const io = new Server(server, {
  cors: {
    origin: frontendURL,
    methods: ["GET", "POST"],
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.data.userId = user._id.toString();
    socket.data.userName = user.name;

    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", async (meetingId, callback) => {
    const reply = typeof callback === "function" ? callback : () => {};

    try {
      if (typeof meetingId !== "string" || !meetingId.trim()) {
        return reply({
          success: false,
          message: "Invalid meeting ID",
        });
      }

      const meeting = await Meeting.findOne({ meetingId });

      if (!meeting || ["cancelled", "completed"].includes(meeting.status)) {
        return reply({
          success: false,
          message: "Meeting unavailable",
        });
      }

      const userId = socket.data.userId;

      const allowed =
        meeting.host.toString() === userId ||
        meeting.participants.some((id) => id.toString() === userId);

      if (!allowed) {
        return reply({
          success: false,
          message: "You are not a participant in this meeting",
        });
      }

      const existingRoom = socket.data.meetingId;

      if (existingRoom === meetingId) {
        return reply({
          success: true,
          socketId: socket.id,
          participants: [
            ...(io.sockets.adapter.rooms.get(meetingId) || []),
          ].filter((id) => id !== socket.id),
        });
      }

      const room = io.sockets.adapter.rooms.get(meetingId);

      const participants = room
        ? [...room].filter((id) => id !== socket.id)
        : [];

      if (participants.length >= 2) {
        return reply({
          success: false,
          message: "This meeting room is full",
        });
      }

      if (existingRoom) {
        socket.to(existingRoom).emit("user-left", {
          socketId: socket.id,
        });

        socket.leave(existingRoom);
        socket.data.meetingId = null;
      }

      socket.join(meetingId);
      socket.data.meetingId = meetingId;

      reply({
        success: true,
        socketId: socket.id,
        participants,
      });

      socket.to(meetingId).emit("user-joined", {
        socketId: socket.id,
        name: socket.data.userName,
      });

      console.log(`${socket.data.userName} joined meeting ${meetingId}`);
    } catch (error) {
      console.error("Join room error:", error.message);

      reply({
        success: false,
        message: "Unable to join meeting",
      });
    }
  });

  socket.on("webrtc-offer", (data = {}) => {
    const { target, offer } = data;
    const meetingId = socket.data.meetingId;

    if (
      !meetingId ||
      typeof target !== "string" ||
      !offer ||
      !io.sockets.adapter.rooms.get(meetingId)?.has(target)
    ) {
      return;
    }

    io.to(target).emit("webrtc-offer", {
      from: socket.id,
      offer,
    });
  });

  socket.on("webrtc-answer", (data = {}) => {
    const { target, answer } = data;
    const meetingId = socket.data.meetingId;

    if (
      !meetingId ||
      typeof target !== "string" ||
      !answer ||
      !io.sockets.adapter.rooms.get(meetingId)?.has(target)
    ) {
      return;
    }

    io.to(target).emit("webrtc-answer", {
      from: socket.id,
      answer,
    });
  });

  socket.on("ice-candidate", (data = {}) => {
    const { target, candidate } = data;
    const meetingId = socket.data.meetingId;

    if (
      !meetingId ||
      typeof target !== "string" ||
      !candidate ||
      !io.sockets.adapter.rooms.get(meetingId)?.has(target)
    ) {
      return;
    }

    io.to(target).emit("ice-candidate", {
      from: socket.id,
      candidate,
    });
  });

  socket.on("send-message", async (data, callback) => {
    const reply = typeof callback === "function" ? callback : () => {};

    try {
      const meetingId = socket.data.meetingId;

      if (!meetingId || !socket.rooms.has(meetingId)) {
        return reply({
          success: false,
          message: "Join a meeting before sending messages",
        });
      }

      const message = data?.message;

      if (
        typeof message !== "string" ||
        !message.trim() ||
        message.trim().length > 1000
      ) {
        return reply({
          success: false,
          message: "Message must contain 1 to 1000 characters",
        });
      }

      const meeting = await Meeting.findOne({
        meetingId,
        status: { $nin: ["completed", "cancelled"] },
        $or: [
          { host: socket.data.userId },
          { participants: socket.data.userId },
        ],
      });

      if (!meeting) {
        return reply({
          success: false,
          message: "Meeting unavailable or access denied",
        });
      }

      const savedMessage = await Message.create({
        meeting: meeting._id,
        sender: socket.data.userId,
        senderName: socket.data.userName,
        message: message.trim(),
      });

      const chatMessage = {
        id: savedMessage._id.toString(),
        senderId: savedMessage.sender.toString(),
        senderName: savedMessage.senderName,
        message: savedMessage.message,
        timestamp: savedMessage.createdAt.toISOString(),
      };

      io.to(meetingId).emit("receive-message", chatMessage);

      reply({
        success: true,
      });
    } catch (error) {
      console.error("Chat error:", error.message);

      reply({
        success: false,
        message: "Failed to send message",
      });
    }
  });

  socket.on("disconnecting", () => {
    const meetingId = socket.data.meetingId;

    if (meetingId) {
      socket.to(meetingId).emit("user-left", {
        socketId: socket.id,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`🚀 IntellMeet Server running on http://localhost:${PORT}`);
      console.log("✅ Socket.io signaling server ready!");
      console.log("✅ Real-time chat enabled!");
      console.log("✅ MongoDB message storage enabled!");
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();