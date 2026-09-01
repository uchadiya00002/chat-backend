import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createServer } from 'http';
import { pubClient, subClient } from '../lib/redis';
import { authenticateSocket } from './authenticateSocket';
import prisma from '../config/prima';
import { z } from 'zod';

const messageSchema = z.object({
  channelId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

export function initSocket(httpServer: ReturnType<typeof createServer>) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN, credentials: true },
  });

  io.adapter(createAdapter(pubClient, subClient));
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;

    socket.on('channel:join', async (channelId: string) => {
      socket.join(channelId);
      await pubClient.sadd(`presence:${channelId}`, userId);
      const online = await pubClient.smembers(`presence:${channelId}`);
      io.to(channelId).emit('presence:update', online);
    });

    socket.on('channel:leave', async (channelId: string) => {
      socket.leave(channelId);
      await pubClient.srem(`presence:${channelId}`, userId);
      const online = await pubClient.smembers(`presence:${channelId}`);
      io.to(channelId).emit('presence:update', online);
    });

    socket.on('message:send', async (payload) => {
      const parsed = messageSchema.safeParse(payload);
      if (!parsed.success) return socket.emit('error', 'Invalid message');

      const message = await prisma.message.create({
        data: { body: parsed.data.body, channelId: parsed.data.channelId, authorId: userId },
        include: { author: { select: { id: true, name: true } } },
      });

      io.to(parsed.data.channelId).emit('message:new', message);
    });

    socket.on('typing:start', (channelId: string) => {
      socket.to(channelId).emit('typing:update', { userId, typing: true });
    });

    socket.on('typing:stop', (channelId: string) => {
      socket.to(channelId).emit('typing:update', { userId, typing: false });
    });

    socket.on('disconnecting', async () => {
      // `disconnecting` fires before Socket.IO clears socket.rooms, unlike `disconnect`.
      const channelIds = [...socket.rooms].filter((room) => room !== socket.id);

      await Promise.all(
        channelIds.map(async (channelId) => {
          await pubClient.srem(`presence:${channelId}`, userId);
          const online = await pubClient.smembers(`presence:${channelId}`);
          io.to(channelId).emit('presence:update', online);
        }),
      );
    });
  });

  return io;
}