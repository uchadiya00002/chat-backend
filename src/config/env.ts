
// WHY THIS EXISTS:
// process.env values are ALL typed as `string | undefined` in TypeScript.
// Without this file, you'd have to write `process.env.JWT_SECRET!` with
// a non-null assertion everywhere — hoping it exists at runtime.
// Instead, validate ONCE at startup. If anything is missing, the server
// refuses to boot and tells you exactly which variable is missing.
// Much better than a cryptic crash 10 minutes later.

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

// safeParse won't throw — it returns a result object you can check
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:');
  // flatten() gives you a clean object of field -> error messages
  console.error(result.error.flatten().fieldErrors);
  process.exit(1); // hard stop — don't boot with broken config
}

export const env = result.data;

// TypeScript now knows env.JWT_ACCESS_SECRET is a string, not string | undefined.
// No more ! assertions scattered across the codebase.