// Four-parameter signature (err, req, res, next) is how Express
// recognises this as an error handler, not a normal middleware.
// It MUST be registered last in app.ts — after all routes.

import { Request, Response, NextFunction } from 'express';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { message: 'Something went wrong. Please try again later.' },
  });
}