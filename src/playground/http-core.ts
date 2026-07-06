// src/playground/http-core.ts
//
// Build an HTTP server with ZERO frameworks — just Node's built-in `http` module.
// Every Express feature (routing, JSON parsing, middleware) is just a wrapper
// around exactly what you see here. Understanding this makes Express click faster.

import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  // req is an IncomingMessage — a readable stream + request metadata
  // res is a ServerResponse — a writable stream you send back to the client

  console.log(`${req.method} ${req.url}`);

  // Manual routing — this is literally what Express Router does under the hood
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/echo') {
    // req is a stream — body arrives in chunks, not all at once
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: body }));
    });
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});