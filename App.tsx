import React, {useEffect, useState} from 'react';
import {View, Text} from 'react-native';

function App() {
  const [steps, setSteps] = useState(0);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) {
        return;
      }

      setStatus('CONNECTING...');

      ws = new WebSocket('ws://10.18.159.125:8080');

      ws.onopen = () => {
        setStatus('LIVE');
        console.log('USER B CONNECTED');
      };

      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'steps' && message.userId === 'userA') {
            setSteps(message.steps);
          }
        } catch (error) {
          console.log('USER B MESSAGE ERROR:', error);
        }
      };

      ws.onerror = error => {
        console.log('USER B WEBSOCKET ERROR:', error);
        setStatus('ERROR');
      };

      ws.onclose = event => {
        console.log('USER B DISCONNECTED:', event.code);
        ws = null;

        if (!stopped) {
          setStatus('RECONNECTING...');
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      stopped = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      ws?.close();
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
      }}>
      <Text style={{fontSize: 24, marginBottom: 25}}>
        USER A
      </Text>

      <Text style={{fontSize: 70, fontWeight: 'bold'}}>
        {steps}
      </Text>

      <Text style={{fontSize: 22, marginTop: 25}}>
        {status}
      </Text>
    </View>
  );
}

export default App;