// WHY app.ts is SEPARATE from server.ts:
// This file builds the Express app but never calls .listen().
// That means you can import `app` in your test files and use
// Supertest to make HTTP requests against it without binding
// a real port — which is how Week 3 testing works.

import express, { Application } from "express";
import { env } from "./config/env";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

const app: Application = express();

// --- Core middleware (runs on every request, in this order) ---
app.use(express.json()); // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse form bodies

// --- Routes ---
// You'll add real routes here from Day 5 onwards as you build them.
// For now, just a health check to confirm the server boots.
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
