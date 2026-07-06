// src/playground/events.ts
//
// Node's EventEmitter is the pattern behind Socket.io's socket.on() / socket.emit().
// Building one by hand makes Socket.io obvious when you get there in Week 2.

import { EventEmitter } from 'events';

const emitter = new EventEmitter();

// Register a listener — same mental model as socket.on('message', handler)
emitter.on('message', (data: { text: string; from: string }) => {
  console.log(`[${data.from}]: ${data.text}`);
});

// One-time listener — fires once then auto-removes itself
emitter.once('connect', (userId: string) => {
  console.log(`User ${userId} connected`);
});

// Emit events — same mental model as socket.emit('message', payload)
emitter.emit('connect', 'user-123');
emitter.emit('message', { text: 'Hello!', from: 'Avii' });
emitter.emit('message', { text: 'How are you?', from: 'Avii' });
emitter.emit('connect', 'user-456'); // won't fire — once() already removed it