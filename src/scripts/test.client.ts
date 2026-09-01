// scripts/test-client.ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  auth: { token: 'PASTE_A_VALID_ACCESS_TOKEN_HERE' },
});

socket.on('connect', () => console.log('connected:', socket.id));
socket.on('connect_error', (err) => console.log('connect error:', err.message));

socket.on('presence:update', (users) => console.log('presence:', users));
socket.on('message:new', (msg) => console.log('new message:', msg));

socket.emit('channel:join', 'PASTE_A_REAL_CHANNEL_ID_HERE');

setTimeout(() => {
  socket.emit('message:send', { channelId: 'PASTE_A_REAL_CHANNEL_ID_HERE', body: 'hello from test client' });
}, 1000);