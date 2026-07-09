// src/playground/typescript-patterns.ts
//
// These are the 5 patterns you'll use repeatedly in Pulse.
// Read each one, understand it, then delete this file.

import { Request, Response } from 'express';

// --- Pattern 1: Interface vs Type ---
// Use `interface` for object shapes (component props, request bodies)
// Use `type` for unions, primitives, and utility compositions

interface User {
  id: string;
  email: string;
  name: string;
}

type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER'; // union — must be `type`, not interface

type PartialUser = Partial<User>; // utility type — also `type`

// --- Pattern 2: Typing req.body ---
// req.body is typed as `any` by default — don't leave it that way.
// Define an interface for what you expect and assert it.

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

function registerHandler(req: Request, res: Response) {
  // Without the interface, req.body.email is `any` — no autocomplete,
  // no error if you typo it as req.body.emai
  const body = req.body as RegisterBody;
  console.log(body.email); // now properly typed
  res.status(201).json({ ok: true });
}

// --- Pattern 3: Optional vs required properties ---
interface CreateChannelInput {
  name: string;           // required — must always be provided
  isPrivate?: boolean;    // optional — may or may not be present
  description?: string;
}

function createChannel(input: CreateChannelInput) {
  // isPrivate could be undefined — TypeScript forces you to handle it
  const isPrivate = input.isPrivate ?? false; // nullish coalescing
  console.log(isPrivate);
}

// --- Pattern 4: Union types for state ---
// This is the discriminated union pattern from your front-end notes —
// same concept, same power, on the backend too

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResponse<T>(response: ApiResponse<T>) {
  if (response.success) {
    console.log(response.data); // TypeScript knows `data` exists here
  } else {
    console.log(response.error); // TypeScript knows `error` exists here
  }
}

// --- Pattern 5: Async function return types ---
// Always type async functions explicitly — it documents intent
// and catches cases where you forget to return something

async function findUserById(id: string): Promise<User | null> {
  // In real code this would be a Prisma query
  if (id === '123') {
    return { id: '123', email: 'avii@example.com', name: 'Avii' };
  }
  return null; // TypeScript ensures you handle the null case at the call site
}

// Call site — TypeScript forces you to handle null
async function example() {
  const user = await findUserById('123');
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log(user.email); // TypeScript knows user is User here, not null
}