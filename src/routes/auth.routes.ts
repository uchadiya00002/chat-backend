import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/prima';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/tokens';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: { message: 'An account with this email already exists' } });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true },
  });

  res.status(201).json({
    user,
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Same error for "no such user" and "wrong password" — don't leak which one it was.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }

  res.status(200).json({
    user: { id: user.id, email: user.email, name: user.name },
    accessToken: signAccessToken(user.id),
    refreshToken: signRefreshToken(user.id),
  });
});

router.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'refreshToken is required' } });
  }

  try {
    const { userId } = verifyRefreshToken(parsed.data.refreshToken);
    res.status(200).json({ accessToken: signAccessToken(userId) });
  } catch {
    res.status(401).json({ error: { message: 'Invalid or expired refresh token' } });
  }
});

export default router;
