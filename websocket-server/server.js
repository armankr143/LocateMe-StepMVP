const WebSocket = require('ws');
const {createClient} = require('@supabase/supabase-js');

const PORT = Number(process.env.PORT) || 8080;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {auth: {persistSession: false, autoRefreshToken: false}},
);

const wss = new WebSocket.Server({port: PORT});

console.log(`WebSocket server running on port ${PORT}`);

wss.on('connection', ws => {
  console.log('CLIENT CONNECTED');

  let authenticatedUserId = null;

  ws.on('message', async data => {
    let message;

    try {
      message = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({type: 'error', message: 'Invalid JSON'}));
      return;
    }

    if (message.type === 'auth') {
      if (authenticatedUserId) return;

      const {data: authData, error} = await supabase.auth.getUser(
        message.accessToken,
      );

      if (error || !authData.user || ws.readyState !== WebSocket.OPEN) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({type: 'auth_error'}));
          ws.close(1008, 'Authentication failed');
        }
        return;
      }

      authenticatedUserId = authData.user.id;
ws.authenticatedUserId = authenticatedUserId;
      ws.send(JSON.stringify({type: 'auth_success'}));
      console.log('AUTHENTICATED USER:', authenticatedUserId);
      return;
    }

    if (!authenticatedUserId) {
      ws.close(1008, 'Authentication required');
      return;
    }

    if (message.type === 'steps') {
      console.log('STEP RECEIVED:', message.steps);
      // Never trust a userId supplied by the Android client.
      // For now, deliver steps only to this user's own authenticated devices.
      const payload = JSON.stringify({
        type: 'steps',
        userId: authenticatedUserId,
        steps: message.steps,
        timestamp: Date.now(),
      });

      wss.clients.forEach(client => {
        if (
          client.readyState === WebSocket.OPEN &&
          client.authenticatedUserId === authenticatedUserId
        ) {
          client.send(payload);
        }
      });
    }
  });

  ws.on('close', () => {
    console.log('CLIENT DISCONNECTED');
  });
});