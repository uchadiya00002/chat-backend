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
- `POST /auth/register`, `/auth/login`, `/auth/refresh` — bcrypt-hashed passwords, JWT access + refresh tokens
- `POST /workspaces`, `GET /workspaces`, `POST /workspaces/:workspaceId/channels`, `GET /workspaces/:workspaceId/channels` — Bearer-token protected, membership-checked
- Prisma schema + migration for `User`, `Workspace`, `WorkspaceMember`, `Channel`, `Message`
- Socket.io server with JWT-based handshake auth, Redis adapter, and full channel/message/presence/typing event handling (see architecture above)

Not yet implemented:

- Message history over REST (all messaging currently happens over sockets, nothing to page through past messages yet)
- Workspace invites — creating a workspace makes you its only member (`OWNER`); there's no way to add anyone else yet

## Getting started

**Prerequisites:** Node.js 20+, Docker (with Compose v2).

Postgres and Redis run locally via [docker-compose.yml](docker-compose.yml): Postgres 16 on `5432` (user `postgres`, password `password`, db `pulse`) and Redis 7 on `6379`, with named volumes so data survives restarts.

#### First-time setup

```bash
pnpm install
cp .env.example .env   # fill in JWT secrets; use the values below for the DBs
#   DATABASE_URL=postgresql://postgres:password@localhost:5432/pulse
#   REDIS_URL=redis://localhost:6379
pnpm services:up         # start Postgres + Redis, wait until healthy
pnpm db:migrate          # apply Prisma migrations (needs Node 20+)
pnpm dev                 # starts the server on $PORT (default 8080)
```

#### After a reboot

Both containers use `restart: unless-stopped`, so as long as the Docker daemon starts on boot (`sudo systemctl enable docker`), they come back up on their own. Just check and run:

```bash
pnpm services:status     # both should show "Up (healthy)"
pnpm dev
```

If they aren't running (e.g. you stopped them with `pnpm services:down` before shutting down), run `pnpm services:up` first.

If you see `Redis ... error: connect ECONNREFUSED 127.0.0.1:6379` on startup, Redis isn't running. Run `pnpm services:up`.

`prisma migrate deploy` (and other Prisma CLI commands) need Node 20+ — a Prisma 7 dependency (`zeptomatch`, pulled in via `@prisma/dev`) is ESM-only and crashes the CLI under Node 18 with `ERR_REQUIRE_ESM`. The app itself (`pnpm dev`/`pnpm build`) runs fine on Node 18. If you're stuck on 18 system-wide, switch first with `nvm use 22` (or run just the Prisma command under a newer version: `nvm exec 22 npx prisma migrate deploy`).

### Scripts

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `pnpm dev`             | Run the server with nodemon + ts-node                        |
| `pnpm build`           | Compile TypeScript to `dist/`                                |
| `pnpm start`           | Run the compiled server (`dist/server.js`)                   |
| `pnpm services:up`     | Start Postgres + Redis containers and wait until healthy     |
| `pnpm services:down`   | Stop the containers (data is kept)                           |
| `pnpm services:status` | Show container status                                        |
| `pnpm db:migrate`      | Apply Prisma migrations (`prisma migrate deploy`, Node 20+)  |

To wipe the local databases completely: `docker compose down -v`.

### Auth

```bash
# Register
curl -X POST localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"password123","name":"Your Name"}'

# Login (same response shape: user, accessToken, refreshToken)
curl -X POST localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"password123"}'

# Exchange a refresh token for a new access token
curl -X POST localhost:8080/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken from login/register>"}'
```

Refresh tokens are verified statelessly (signature + expiry only) — there's no revocation list yet, so a leaked refresh token stays valid until it expires. Fine for now, worth revisiting before this goes anywhere near production.

### Workspaces & channels

All routes below require `Authorization: Bearer <accessToken>` from `/auth/login` or `/auth/register`.

```bash
# Create a workspace — you become its OWNER automatically
curl -X POST localhost:8080/workspaces \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Acme Corp"}'

# List workspaces you're a member of
curl localhost:8080/workspaces -H "Authorization: Bearer $TOKEN"

# Create a channel (any member can; unique per workspace)
curl -X POST localhost:8080/workspaces/<workspaceId>/channels \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"general"}'

# List channels in a workspace
curl localhost:8080/workspaces/<workspaceId>/channels -H "Authorization: Bearer $TOKEN"
```

The channel's `id` from that response is what you join over the socket (`channel:join`) or paste into the chat client.

### Trying the socket layer

`src/scripts/test.client.ts` is a minimal Socket.io client for manual testing. Paste the `accessToken` from `/auth/login` and a channel ID from `POST /workspaces/<workspaceId>/channels` above, then run:

```bash
npx ts-node src/scripts/test.client.ts
```

## Frontend

The client lives in a sibling repo, [chat-client](../chat-client) — a minimal React + TypeScript app for exercising the whole stack: register/login, join a channel by ID, send messages, and see presence + typing update live. See its README for setup.

## Project structure

```text
src/
├── server.ts               # HTTP server bootstrap (keeps app.ts free of .listen)
├── app.ts                  # Express app: middleware, routes, error handlers
├── config/
│   ├── env.ts               # Zod-validated environment variables
│   └── prima.ts             # Prisma client singleton (pg adapter)
├── lib/
│   ├── redis.ts              # ioredis pub/sub clients for the Socket.io adapter
│   └── tokens.ts             # JWT sign/verify helpers (access + refresh)
├── middleware/
│   ├── authenticate.ts        # Bearer-token auth guard for HTTP routes
│   └── errorHandler.ts       # 404 + centralized error handling
├── routes/
│   ├── auth.routes.ts         # POST /auth/register, /login, /refresh
│   └── workspaces.routes.ts   # Workspace + channel creation/listing
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

**Auth: stateless refresh tokens**
`/auth/refresh` only verifies the token's signature and expiry — it doesn't check anything server-side. That's a deliberate v1 simplification: it means zero extra DB/Redis round trips to refresh a session, at the cost of not being able to revoke a specific token before it expires (see "What I'd add next").

## What I'd add next

- Refresh token revocation (e.g. store issued/rotated refresh tokens in Redis or the DB so a logout or compromise can actually invalidate one)
- Workspace invites — right now creating a workspace makes you its only member
- Message history over REST, paginated (cursor-based, using the existing `createdAt` index)
- Read receipts
- Rate limiting on `message:send` per user (Redis-backed sliding window)
- Presence via connection-count hash (see trade-off above)
- Horizontal scale test — run two instances behind a load balancer, confirm Redis adapter actually syncs state under load
