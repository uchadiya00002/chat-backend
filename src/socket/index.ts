import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer } from "http";
import { pubClient, subClient } from "../lib/redis";
import { authenticateSocket } from "./authenticateSocket";
import prisma from "../config/prima";
import { env } from "../config/env";
import { z } from "zod";

const messageSchema = z.object({
  channelId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

const reportSocketError = (
  socket: { emit: (event: string, payload: unknown) => void },
  event: string,
  error: unknown,
  fallbackMessage = "Something went wrong",
) => {
  console.error(`${event} failed`, error);
  socket.emit("error", { event, message: fallbackMessage });
};

export function initSocket(httpServer: ReturnType<typeof createServer>) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  io.adapter(createAdapter(pubClient, subClient));
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    socket.on("channel:join", async (channelId: string) => {
      try {
        if (!channelId) {
          return socket.emit("error", {
            event: "channel:join",
            message: "Channel id is required",
          });
        }

        socket.join(channelId);
        await pubClient.sadd(`presence:${channelId}`, userId);
        const online = await pubClient.smembers(`presence:${channelId}`);
        io.to(channelId).emit("presence:update", online);
      } catch (error) {
        reportSocketError(
          socket,
          "channel:join",
          error,
          "Could not join channel",
        );
      }
    });

    socket.on("channel:leave", async (channelId: string) => {
      try {
        if (!channelId) {
          return socket.emit("error", {
            event: "channel:leave",
            message: "Channel id is required",
          });
        }

        socket.leave(channelId);
        await pubClient.srem(`presence:${channelId}`, userId);
        const online = await pubClient.smembers(`presence:${channelId}`);
        io.to(channelId).emit("presence:update", online);
      } catch (error) {
        reportSocketError(
          socket,
          "channel:leave",
          error,
          "Could not leave channel",
        );
      }
    });

    socket.on("message:send", async (payload) => {
      try {
        const parsed = messageSchema.safeParse(payload);
        if (!parsed.success) {
          return socket.emit("error", {
            event: "message:send",
            message: "Invalid message payload",
          });
        }

        const message = await prisma.message.create({
          data: {
            body: parsed.data.body,
            channelId: parsed.data.channelId,
            authorId: userId,
          },
          include: { author: { select: { id: true, name: true } } },
        });

        io.to(parsed.data.channelId).emit("message:new", message);
      } catch (error) {
        reportSocketError(
          socket,
          "message:send",
          error,
          "Could not send message",
        );
      }
    });

    socket.on("typing:start", (channelId: string) => {
      try {
        socket.to(channelId).emit("typing:update", { userId, typing: true });
      } catch (error) {
        reportSocketError(
          socket,
          "typing:start",
          error,
          "Could not start typing",
        );
      }
    });

    socket.on("typing:stop", (channelId: string) => {
      try {
        socket.to(channelId).emit("typing:update", { userId, typing: false });
      } catch (error) {
        reportSocketError(
          socket,
          "typing:stop",
          error,
          "Could not stop typing",
        );
      }
    });

    socket.on("disconnecting", async () => {
      try {
        // `disconnecting` fires before Socket.IO clears socket.rooms, unlike `disconnect`.
        const channelIds = [...socket.rooms].filter(
          (room) => room !== socket.id,
        );

        await Promise.all(
          channelIds.map(async (channelId) => {
            await pubClient.srem(`presence:${channelId}`, userId);
            const online = await pubClient.smembers(`presence:${channelId}`);
            io.to(channelId).emit("presence:update", online);
          }),
        );
      } catch (error) {
        reportSocketError(
          socket,
          "disconnecting",
          error,
          "Could not clean up presence",
        );
      }
    });
  });

  return io;
}
