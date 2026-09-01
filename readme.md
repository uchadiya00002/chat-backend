# Pulse — Real-Time Chat Backend

A Slack-style chat backend built to explore real-time systems design: WebSocket messaging, horizontal scalability via Redis, and JWT-based auth with role-based workspace access.

## Stack

- **Node.js + Express + TypeScript** — API layer
- **PostgreSQL + Prisma** — persistence
- **Socket.io** — real-time transport (WebSocket with polling fallback)
- **Redis** (`ioredis`) — pub/sub adapter for horizontal scaling, presence tracking
- **JWT** — access/refresh token auth
- **Zod** — runtime validation on all socket events and API inputs

## Architecture

```text
Client ──HTTP──▶ Express API ──▶ Prisma ──▶ PostgreSQL
   │
   └──WebSocket──▶ Socket.io Server
                        │
                        ├── Redis Adapter (pub/sub) ──▶ Redis
                        │      (cross-instance message + presence sync)
                        │
                        └── Room per Channel
                               ├── message:send  → persist to DB → broadcast to room
                               ├── channel:join   → add to presence set (Redis)
                               ├── channel:leave  → remove from presence set
                               ├── typing:start/stop → ephemeral, room-only, no DB write
                               └── disconnecting  → cleanup presence before rooms clear
```

### Data model

- `Workspace` → `WorkspaceMember` (explicit join table, not implicit many-to-many) → `User`
  - Explicit join model chosen specifically so `role` (OWNER/ADMIN/MEMBER) can live on the membership itself, not just the relationship.
- `Channel` belongs to a `Workspace`; `Message` belongs to a `Channel` and an author.
- Composite index on `Message(channelId, createdAt)` — the dominant query in any chat app is "latest N messages in this channel," and this index serves that directly instead of requiring a table scan + sort.

## Current status

This is under active development. Implemented so far:

- Express app with env validation, JSON body parsing, and a `/health` endpoint
- Prisma schema + migration for `User`, `Workspace`, `WorkspaceMember`, `Channel`, `Message`
- Socket.io server with JWT-based handshake auth, Redis adapter, and full channel/message/presence/typing event handling (see architecture above)

Not yet implemented:

- HTTP auth routes (register/login/refresh) — the socket layer verifies JWTs, but nothing issues them yet
- REST endpoints for workspaces, channels, and message history (all messaging currently happens over sockets)

## Getting started

**Prerequisites:** Node.js, PostgreSQL, Redis.

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, JWT secrets, etc.
npx prisma migrate deploy
pnpm dev                 # starts the server on $PORT (default 8080)
```

### Scripts

| Command      | Description                                |
| ------------ | ------------------------------------------ |
| `pnpm dev`   | Run the server with nodemon + ts-node      |
| `pnpm build` | Compile TypeScript to `dist/`              |
| `pnpm start` | Run the compiled server (`dist/server.js`) |

### Trying the socket layer

`src/scripts/test.client.ts` is a minimal Socket.io client for manual testing. Since there's no login endpoint yet, generate an access token by hand (e.g. via a quick `jsonwebtoken.sign` script using `JWT_ACCESS_SECRET`) and paste it in, along with a real channel ID, then run:

```bash
npx ts-node src/scripts/test.client.ts
```

## Project structure

```text
src/
├── server.ts               # HTTP server bootstrap (keeps app.ts free of .listen)
├── app.ts                  # Express app: middleware, routes, error handlers
├── config/
│   ├── env.ts               # Zod-validated environment variables
│   └── prima.ts             # Prisma client singleton (pg adapter)
├── lib/
│   └── redis.ts              # ioredis pub/sub clients for the Socket.io adapter
├── middleware/
│   └── errorHandler.ts       # 404 + centralized error handling
├── socket/
│   ├── index.ts               # Socket.io server, event handlers, presence logic
│   └── authenticateSocket.ts  # JWT verification middleware for the socket handshake
├── scripts/
│   └── test.client.ts         # Manual socket test client
└── playground/               # Node/Express/TypeScript fundamentals exercises (not part of the app)
```

## Key design decisions

**Why Redis pub/sub instead of a single Socket.io instance?**
A single Node process holding all WebSocket connections in memory works until you need more than one server instance (for uptime or load). The Redis adapter lets multiple Socket.io instances share room/broadcast state: a message received by instance A gets published to Redis and relayed to clients connected on instance B. This is what makes the app horizontally scalable rather than tied to a single process.

**Why rooms per channel instead of broadcasting to all connected clients?**
Broadcasting globally means every client's socket receives every message system-wide and filters client-side — wasteful and doesn't scale past a handful of users. Rooms let Socket.io deliver a message only to sockets that joined that specific channel, so the fan-out cost scales with channel size, not total user count.

**Presence tracking: known trade-off**
Presence is currently a Redis `SET` per channel (`presence:{channelId}` → set of userIds). This works for the single-tab case, but if a user has two tabs open and closes one, they'll incorrectly show as offline even though their other tab is still connected — sets don't track connection count, just membership.

*Fix for production*: use a Redis hash (`userId → connectionCount`) and only mark a user offline when their count hits zero. Not implemented here deliberately, to keep v1 scoped — but it's the first thing I'd change with more time, and a good example of shipping a correct-for-now solution while knowing its limits.

**Auth: `disconnecting` vs `disconnect` event**
Socket.io clears `socket.rooms` before firing `disconnect`, but not before `disconnecting`. Presence cleanup reads `socket.rooms` to know which channels to remove the user from — using `disconnect` here would silently no-op, since rooms would already be empty by the time the handler runs.

## What I'd add next

- HTTP auth routes (register/login/refresh) so the socket layer has a real way to obtain tokens
- REST endpoints for workspaces, channels, and paginated message history
- Message pagination (cursor-based, using the existing `createdAt` index)
- Read receipts
- Rate limiting on `message:send` per user (Redis-backed sliding window)
- Presence via connection-count hash (see trade-off above)
- Horizontal scale test — run two instances behind a load balancer, confirm Redis adapter actually syncs state under load
