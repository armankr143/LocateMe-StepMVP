import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from 'react-native';

const {StepCounter} = NativeModules;

function App() {
  const [steps, setSteps] = useState(0);
  const [permission, setPermission] = useState('Checking...');

  useEffect(() => {
    let subscription: any;

    const start = async () => {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        );

        setPermission(result);

        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          return;
        }
      }

      const stepEmitter = new NativeEventEmitter(StepCounter);

      subscription = stepEmitter.addListener(
        'StepCounterUpdate',
        event => {
          setSteps(Math.floor(event.steps));
        },
      );

      StepCounter.startListening();
    };

    start();

    return () => {
      subscription?.remove();
      StepCounter?.stopListening?.();
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
    </View>
  );
}

export default App;