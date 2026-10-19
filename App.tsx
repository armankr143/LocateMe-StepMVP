
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
  const [lastStepTime, setLastStepTime] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const previousStepsRef = useRef<number | null>(null);

  useEffect(() => {
    let subscription: any;
    let cancelled = false;


    const ws = new WebSocket('wss://locateme-websocket.onrender.com');
    

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

      if (cancelled) {
        return;
      }

      setPermission(result);

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return;
      }

      const stepEmitter = new NativeEventEmitter(StepCounter);

      subscription = stepEmitter.addListener(
        'StepCounterUpdate',
        event => {
          const currentSteps = Math.floor(event.steps);
          const previousSteps = previousStepsRef.current;

          setSteps(currentSteps);

          // Only reset the timer when the step count increases.
          if (
            previousSteps !== null &&
            currentSteps > previousSteps
          ) {
            const now = Date.now();
            setLastStepTime(now);
            setSecondsAgo(0);
          }

          previousStepsRef.current = currentSteps;

          // Preserve existing WebSocket step sharing.
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
      cancelled = true;
      subscription?.remove();
      StepCounter?.stopListening?.();
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastStepTime !== null) {
        const elapsed = Math.floor(
          (Date.now() - lastStepTime) / 1000,
        );
        setSecondsAgo(Math.max(0, elapsed));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastStepTime]);

  
  const lastStepLabel = (() => {
  if (secondsAgo === null) {
    return 'Waiting for next step...';
  }

  if (secondsAgo < 3) {
    return 'Walking';
  }

  if (secondsAgo < 5) {
    return 'Last step: Just now';
  }

  const elapsed = secondsAgo - 3;

  if (elapsed < 60) {
    return `Last step: ${elapsed} second${elapsed === 1 ? '' : 's'} ago`;
  }

  if (elapsed < 3600) {
    const minutes = Math.floor(elapsed / 60);
    return `Last step: ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(elapsed / 3600);
  return `Last step: ${hours} hour${hours === 1 ? '' : 's'} ago`;
})();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'red',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
      <Text style={{fontSize: 30, color: 'white'}}>
        Steps: {steps}
      </Text>

      <Text
        style={{
          fontSize: 24,
          color: 'white',
          marginTop: 20,
          fontWeight: 'bold',
          textAlign: 'center',
        }}>
        {lastStepLabel}
      </Text>

      <Text style={{fontSize: 20, color: 'white', marginTop: 20}}>
        Permission: {permission}
      </Text>

      <Text style={{fontSize: 20, color: 'white'}}>
        WebSocket: {wsStatus}
      </Text>
    </View>
  );
}

export default App;
