// src/playground/middleware.ts

import express, { Request, Response, NextFunction } from "express";

const app = express();
app.use(express.json());

// --- Middleware 1: Logging ---
// Runs on EVERY request because it's registered with app.use()
// with no path — it matches everything
function logger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  console.log(`--> ${req.method} ${req.url}`);

  // Intercept res.json to log response time AFTER the response is sent
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    console.log(
      `<-- ${req.method} ${req.url} ${res.statusCode} (${Date.now() - start}ms)`,
    );
    return originalJson(body);
  };

  next(); // MUST call this or the request hangs here forever
}

// --- Middleware 2: Fake auth check ---
// Runs only on routes that explicitly include it
function fakeAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization;

  if (!token) {
    // Sending a response WITHOUT calling next() — this terminates
    // the chain. The route handler below never runs.
    res.status(401).json({ error: "No token provided" });
    return;
  }

  // Attach data to req for downstream handlers to use.
  // This is the pattern auth middleware uses in the real app.
  (req as Request & { user: { id: string; email: string } }).user = {
    id: "user-123",
    email: "avii@example.com",
  };
  next();
}

// Register logger globally — runs before every route
app.use(logger);

// Public route — no auth middleware
app.get("/public", (req: Request, res: Response) => {
  res.json({ message: "Anyone can see this" });
});

// Protected route — fakeAuth runs BEFORE the handler
// If fakeAuth calls res.json(401), the handler below never runs
app.get("/protected", fakeAuth, (req: Request, res: Response) => {
  res.json({ message: "You are authenticated" });
});

app.listen(3002, () => console.log("Middleware demo on http://localhost:3002"));
