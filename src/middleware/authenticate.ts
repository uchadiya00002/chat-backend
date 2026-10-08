// HTTP counterpart to socket/authenticateSocket.ts — same access token,
// same secret, but pulled from the Authorization header instead of the
// socket handshake.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: { message: 'Missing or invalid Authorization header' } });
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
    req.user = { id: payload.userId };
    next();
  } catch {
    res.status(401).json({ error: { message: 'Invalid or expired access token' } });
  }
}
