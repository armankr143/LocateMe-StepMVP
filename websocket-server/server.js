const WebSocket = require('ws');

const wss = new WebSocket.Server({
  port: 8080,
});

console.log('WebSocket server running on port 8080');

wss.on('connection', ws => {
  console.log('CLIENT CONNECTED');

  ws.on('message', data => {
    const message = data.toString();

    console.log('RECEIVED:', message);

    // Send the message to every connected client
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('CLIENT DISCONNECTED');
  });
});