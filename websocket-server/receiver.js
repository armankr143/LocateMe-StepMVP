const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:8080');

ws.on('open', () => {
  console.log('USER B CONNECTED');
});

ws.on('message', data => {
  const message = data.toString();

  console.log('USER B RECEIVED:', message);
});

ws.on('close', () => {
  console.log('USER B DISCONNECTED');
});

ws.on('error', error => {
  console.log('USER B ERROR:', error.message);
});