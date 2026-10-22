const WebSocket = require('ws');
const {createClient} = require('@supabase/supabase-js');

const PORT = Number(process.env.PORT) || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

// This client is used only to validate incoming access tokens.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {persistSession: false, autoRefreshToken: false},
});

const wss = new WebSocket.Server({port: PORT});
console.log(`WebSocket server running on port ${PORT}`);

wss.on('connection', ws => {
  console.log('CLIENT CONNECTED');

  let authenticatedUserId = null;
  let userSupabase = null;
  let authenticating = false;

  ws.on('message', async data => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({type: 'error', message: 'Invalid JSON'}));
      return;
    }

    if (message.type === 'auth') {
      if (authenticatedUserId || authenticating) return;
      if (typeof message.accessToken !== 'string' || !message.accessToken) {
        ws.close(1008, 'Access token required');
        return;
      }

      authenticating = true;
      try {
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

        // Query connections with this user's JWT so Supabase RLS applies.
        // This uses the same Supabase anon key already configured on Render.
        userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          accessToken: async () => message.accessToken,
          auth: {persistSession: false, autoRefreshToken: false},
        });

        ws.send(JSON.stringify({type: 'auth_success'}));
        console.log('AUTHENTICATED USER:', authenticatedUserId);
      } catch (error) {
        console.error('AUTH ERROR:', error.message);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({type: 'auth_error'}));
          ws.close(1008, 'Authentication failed');
        }
      } finally {
        authenticating = false;
      }
      return;
    }

    if (!authenticatedUserId || !userSupabase) {
      ws.close(1008, 'Authentication required');
      return;
    }

    if (message.type === 'steps') {
      const steps = Number(message.steps);
      if (!Number.isSafeInteger(steps) || steps < 0) {
        console.log('INVALID STEP VALUE');
        return;
      }

      // Only accepted connections may receive this person's activity.
      // A connection can list this user as either sender or receiver.
      try {
        const {data: connections, error} = await userSupabase
          .from('connections')
          .select('sender_id,receiver_id')
          .eq('status', 'accepted')
          .or(
            `sender_id.eq.${authenticatedUserId},receiver_id.eq.${authenticatedUserId}`,
          );

        if (error) {
          console.error('CONNECTION LOOKUP ERROR:', error.message);
          return; // Fail closed: never broadcast without authorization.
        }

        const recipients = new Set([authenticatedUserId]);
        for (const connection of connections || []) {
          if (connection.sender_id === authenticatedUserId) {
            recipients.add(connection.receiver_id);
          } else if (connection.receiver_id === authenticatedUserId) {
            recipients.add(connection.sender_id);
          }
        }

        const payload = JSON.stringify({
          type: 'steps',
          userId: authenticatedUserId, // Never trust a client-supplied userId.
          steps,
          timestamp: Date.now(),
        });

        let delivered = 0;
        wss.clients.forEach(client => {
          if (
            client.readyState === WebSocket.OPEN &&
            recipients.has(client.authenticatedUserId)
          ) {
            client.send(payload);
            delivered++;
          }
        });
        console.log('STEP FORWARDED:', steps, 'clients:', delivered);
      } catch (error) {
        console.error('STEP FORWARD ERROR:', error.message);
      }
    }
  });

  ws.on('close', () => {
    console.log('CLIENT DISCONNECTED:', authenticatedUserId || 'unauthenticated');
  });
});