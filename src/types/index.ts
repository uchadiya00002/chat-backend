// src/types/index.ts
// Shared TypeScript types for reuse across the project

export interface User {
  id: string;
  email: string;
  name: string;
}

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type PartialUser = Partial<User>;

export interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

export interface CreateChannelInput {
  name: string;
  isPrivate?: boolean;
  description?: string;
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
