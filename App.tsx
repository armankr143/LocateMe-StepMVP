import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
} from 'react-native';

const {StepCounter} = NativeModules;

function App() {
  const [steps, setSteps] = useState(0);
  const [permission, setPermission] = useState('Checking...');
  const [wsStatus, setWsStatus] = useState('Disconnected');

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let subscription: any;

    // Connect User A to our WebSocket server
  
    const ws = new WebSocket('ws://10.18.159.125:8080');

    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WEBSOCKET CONNECTED');
      setWsStatus('Connected');
    };

    ws.onerror = event => {
      console.log('WEBSOCKET ERROR:', event);
      setWsStatus('Error');
    };

    ws.onclose = () => {
      console.log('WEBSOCKET CLOSED');
      setWsStatus('Disconnected');
    };

    const start = async () => {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      );

      setPermission(result);

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return;
      }

      const stepEmitter = new NativeEventEmitter(StepCounter);

      subscription = stepEmitter.addListener(
        'StepCounterUpdate',
        event => {
          const currentSteps = Math.floor(event.steps);

          setSteps(currentSteps);

          // Send User A's steps to WebSocket server
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const message = {
              type: 'steps',
              userId: 'userA',
              steps: currentSteps,
              timestamp: Date.now(),
            };

            wsRef.current.send(JSON.stringify(message));

            console.log('SENT TO SERVER:', message);
          }
        },
      );

      StepCounter.startListening();
    };

    start();

    return () => {
      subscription?.remove();
      StepCounter?.stopListening?.();

      wsRef.current?.close();
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'red',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Text style={{fontSize: 30, color: 'white'}}>
        Steps: {steps}
      </Text>

      <Text style={{fontSize: 20, color: 'white'}}>
        Permission: {permission}
      </Text>

      <Text style={{fontSize: 20, color: 'white'}}>
        WebSocket: {wsStatus}
      </Text>
    </View>
  );
}

export default App;