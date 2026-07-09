// Only job: import app and start listening on a port.
// Keeping this separate from app.ts means tests never accidentally
// bind a port — they import app directly.

import 'dotenv/config'; // MUST be first line — loads .env before any other import
import { env } from './config/env';
import app from './app';


const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`Pulse API running on http://localhost:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`)
});