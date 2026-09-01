import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      userId: string;
    };
    socket.data.userId = payload.userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
}
