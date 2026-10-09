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

const validateChannelAccess = async (userId: string, channelId: string) => {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, workspaceId: true },
  });

  if (!channel) {
    throw new Error("Channel not found");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: channel.workspaceId,
      },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new Error("User is not a member of this workspace");
  }

  return channel;
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

        await validateChannelAccess(userId, channelId);

        socket.join(channelId);
        await pubClient.sadd(`presence:${channelId}`, userId);
        const online = await pubClient.smembers(`presence:${channelId}`);
        io.to(channelId).emit("presence:update", online);
      } catch (error) {
        const message =
          error instanceof Error && error.message === "Channel not found"
            ? "Channel not found"
            : error instanceof Error && error.message === "User is not a member of this workspace"
              ? "You do not have access to this channel"
              : "Could not join channel";

        reportSocketError(socket, "channel:join", error, message);
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

        await validateChannelAccess(userId, parsed.data.channelId);

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
        const message =
          error instanceof Error && error.message === "Channel not found"
            ? "Channel not found"
            : error instanceof Error && error.message === "User is not a member of this workspace"
              ? "You do not have access to this channel"
              : "Could not send message";

        reportSocketError(socket, "message:send", error, message);
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
