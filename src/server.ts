// Only job: import app and start listening on a port.
// Keeping this separate from app.ts means tests never accidentally
// bind a port — they import app directly.

import 'dotenv/config';
import http from 'http';
import { env } from './config/env';
import app from './app';
import { initSocket } from './socket';

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`Chat Backend running on http://localhost:${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});