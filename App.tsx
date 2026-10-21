
import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import LoginScreen from './LoginScreen';
import {supabase} from './supabase';
const {StepCounter} = NativeModules;

function LocateMeHome({userId}: {userId: string}) {


  const [steps, setSteps] = useState(0);
  const [permission, setPermission] = useState('Checking...');
  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [lastStepTime, setLastStepTime] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsAuthenticatedRef = useRef(false);
  const previousStepsRef = useRef<number | null>(null);

  useEffect(() => {
    let subscription: any;
    let cancelled = false;


    const ws = new WebSocket(
  'wss://locateme-websocket.onrender.com',
);

ws.onopen = () => {
  console.log('WEBSOCKET CONNECTED');
  setWsStatus('Connected');

  supabase.auth.getSession().then(({data, error}) => {
    if (error || !data.session) {
      console.log('WEBSOCKET AUTH: No valid session');
      ws.close();
      return;
    }

    ws.send(
      JSON.stringify({
        type: 'auth',
        accessToken: data.session.access_token,
      }),
    );
  });
};
    

    wsRef.current = ws;
    wsAuthenticatedRef.current = false;

ws.onmessage = event => {
  try {
    const message = JSON.parse(String(event.data));

    if (message.type === 'auth_success') {
      wsAuthenticatedRef.current = true;
      setWsStatus('Authenticated');
      console.log('WEBSOCKET AUTHENTICATED');
    }

    if (message.type === 'auth_error') {
      wsAuthenticatedRef.current = false;
      setWsStatus('Authentication failed');
      ws.close();
    }
  } catch (error) {
    console.log('WEBSOCKET MESSAGE ERROR:', error);
  }
};

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
          
          const currentSteps = Math.floor((event as {steps: number}).steps);
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
          if (
  wsAuthenticatedRef.current &&
  wsRef.current?.readyState === WebSocket.OPEN
) {
            const message = {
              type: 'steps',
              userId: 'userId',
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

      ws.onclose = () => {
  console.log('WEBSOCKET CLOSED');
  wsAuthenticatedRef.current = false;
  setWsStatus('Disconnected');
};
      

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

function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  useEffect(() => {
    const handleMagicLink = async (url: string | null) => {
      if (!url || !url.startsWith('locateme://auth/callback')) {
        return;
      }

      try {
        const query = url.split('?')[1]?.split('#')[0] ?? '';
        const params = new URLSearchParams(query);

        const tokenHash = params.get('token_hash');
        const type = params.get('type');

        if (tokenHash && (type === 'magiclink' || type === 'email')) {
          const {error} = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'magiclink' | 'email',
          });

          if (error) throw error;
          return;
        }

        const fragment = url.split('#')[1] ?? '';
        const hashParams = new URLSearchParams(fragment);

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const {error} = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
        } else {
          console.log('Magic link contained no session tokens.');
        }
      } catch (error: any) {
        console.log('MAGIC LINK ERROR:', error?.message);
      }
    };

    const subscription = Linking.addEventListener('url', event => {
      void handleMagicLink(event.url);
    });

  
    void Linking.getInitialURL().then(url => handleMagicLink(url ?? null));

    return () => subscription.remove();
  }, []);

  

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession()
      .then(({data, error}) => {
        if (!mounted) return;

        if (error) {
          console.log('SESSION ERROR:', error.message);
        }

        setSession(data.session);
        setAuthLoading(false);
      })
      .catch(error => {
        console.log('SESSION ERROR:', error);
        if (mounted) setAuthLoading(false);
      });

    const {data: listener} = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          setSession(newSession);
          setAuthLoading(false);
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#101827',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text style={{color: 'white'}}>
          Loading LocateMe...
        </Text>
      </View>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={() => {}} />;
  }

  return <LocateMeHome userId={session.user.id} />;
}

export default App;

