// src/types/express.d.ts
//
// WHY THIS FILE EXISTS:
// Express's Request type doesn't know about `req.user` — that's
// something WE attach in our auth middleware. Declaration merging
// lets us tell TypeScript "Request also has this property" without
// touching Express's own types.
//
// Once this file exists, req.user is typed EVERYWHERE automatically —
// no imports needed, no manual casting in every controller.

declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email: string;
    };
  }
}