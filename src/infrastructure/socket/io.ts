import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "../logger";

let io: Server | null = null;

export interface SocketUser {
  _id: string;
  email: string;
  role: string;
}

export function initSocketServer(server: HttpServer): Server {
  if (io) return io;

  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev/local
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Authentication Middleware for Handshakes
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "") ||
        socket.handshake.query?.token;

      if (!token) {
        // Allow anonymous sockets for public order tracking if needed, but mark unauthenticated
        socket.data.user = null;
        return next();
      }

      const secret = process.env.JWT_SECRET || "supersecretjwtkey";
      const decoded = jwt.verify(token as string, secret) as any;

      socket.data.user = {
        _id: decoded.userId || decoded.sub || decoded.id,
        email: decoded.email,
        role: decoded.role,
      };

      logger.info({ userId: socket.data.user._id }, "Socket authenticated successfully");
      next();
    } catch (err) {
      logger.warn({ err }, "Socket authentication failed; continuing as guest socket");
      socket.data.user = null;
      next();
    }
  });

  io.on("connection", (socket: Socket) => {
    const user: SocketUser | null = socket.data.user;

    if (user && user._id) {
      // Auto-join personal room for private notifications
      const userRoom = `user:${user._id}`;
      socket.join(userRoom);
      logger.info({ socketId: socket.id, userRoom }, "User joined personal room");

      // Role specific rooms
      if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
        socket.join("admin:room");
      }
      if (user.role === "DELIVERY_AGENT") {
        socket.join("riders:active");
      }
    }

    // Join order updates room
    socket.on("join:order", (orderId: string) => {
      if (!orderId) return;
      socket.join(`order:${orderId}`);
      logger.debug({ socketId: socket.id, orderId }, "Joined order room");
    });

    socket.on("leave:order", (orderId: string) => {
      if (!orderId) return;
      socket.leave(`order:${orderId}`);
    });

    // Join delivery task tracking room
    socket.on("join:delivery", (taskId: string) => {
      if (!taskId) return;
      socket.join(`delivery:${taskId}`);
      logger.debug({ socketId: socket.id, taskId }, "Joined delivery room");
    });

    socket.on("leave:delivery", (taskId: string) => {
      if (!taskId) return;
      socket.leave(`delivery:${taskId}`);
    });

    // Chat room join/leave
    socket.on("join:chat", (conversationId: string) => {
      if (!conversationId) return;
      socket.join(`chat:${conversationId}`);
      logger.debug({ socketId: socket.id, conversationId }, "Joined chat room");
    });

    socket.on("leave:chat", (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(`chat:${conversationId}`);
    });

    // Typing indicators
    socket.on("chat:typing", (data: { conversationId: string; isTyping: boolean }) => {
      if (!data?.conversationId || !user?._id) return;
      socket.to(`chat:${data.conversationId}`).emit("chat:user_typing", {
        conversationId: data.conversationId,
        userId: user._id,
        isTyping: Boolean(data.isTyping),
      });
    });

    // Real-time GPS location broadcast from rider
    socket.on("rider:location", (data: { taskId?: string; lat: number; lon: number }) => {
      if (!user || user.role !== "DELIVERY_AGENT") return;
      if (!data || typeof data.lat !== "number" || typeof data.lon !== "number") return;

      const payload = {
        riderId: user._id,
        taskId: data.taskId,
        lat: data.lat,
        lon: data.lon,
        timestamp: new Date().toISOString(),
      };

      if (data.taskId) {
        io?.to(`delivery:${data.taskId}`).emit("delivery:location_updated", payload);
      }
      io?.to("admin:room").emit("rider:location_stream", payload);
    });

    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, reason }, "Socket client disconnected");
    });
  });

  logger.info("Socket.IO server initialized with real-time event pipeline");
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.IO server not initialized. Call initSocketServer() first.");
  }
  return io;
}

export function isSocketInitialized(): boolean {
  return Boolean(io);
}
