// WHY app.ts is SEPARATE from server.ts:
// This file builds the Express app but never calls .listen().
// That means you can import `app` in your test files and use
// Supertest to make HTTP requests against it without binding
// a real port — which is how Week 3 testing works.

import express, { Application } from "express";
import cors from "cors";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import authRouter from "./routes/auth.routes";
import workspacesRouter from "./routes/workspaces.routes";

const app: Application = express();

// --- Core middleware (runs on every request, in this order) ---
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true })); // allow the frontend's origin
app.use(express.json()); // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse form bodies

// --- Routes ---
app.use("/auth", authRouter);
app.use("/workspaces", workspacesRouter);

app.get("/health", (req, res) => {
  res
    .status(200)
    .json({
      status: "ok",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
});

// --- 404 + error handlers — ALWAYS LAST ---
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
