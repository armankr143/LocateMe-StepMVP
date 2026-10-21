
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {supabase} from './supabase';

type Props = {
  onLogin: () => void;
};

export default function LoginScreen({onLogin}: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'details' | 'otp'>('details');
  const [loading, setLoading] = useState(false);

  const sendOTP = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (
      !name.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      Alert.alert('Error', 'Enter your name and a valid email.');
      return;
    }

    setLoading(true);

    try {
      const {error} = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          data: {full_name: name.trim()},
        },
      });

      if (error) throw error;

      setStage('otp');
      Alert.alert(
        'Check your email',
        'Enter the eight-digit verification code sent to your email.',
      );
    } catch (error: any) {
      Alert.alert('OTP Error', error?.message || 'Unable to send code.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!/^\d{8}$/.test(otp)) {
      Alert.alert('Error', 'Enter a valid eight-digit code.');
      return;
    }

    setLoading(true);

    try {
      const {data, error} = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      if (!data.session) {
        throw new Error('No authenticated session returned.');
      }

      onLogin();
    } catch (error: any) {
      Alert.alert(
        'Verification Failed',
        error?.message || 'Invalid or expired code.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LocateMe</Text>

      <Text style={styles.subtitle}>
        Stay connected through activity
      </Text>

      {stage === 'details' ? (
        <>
          <TextInput
            placeholder="Your Name"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />

          <TextInput
            placeholder="Email Address"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          <TouchableOpacity
            disabled={loading}
            onPress={sendOTP}
            style={styles.button}>
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.message}>
            Enter the eight-digit code sent to {email}
          </Text>

          <TextInput
            placeholder="8-digit OTP"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            maxLength={8}
            value={otp}
            onChangeText={setOtp}
            style={styles.input}
          />

          <TouchableOpacity
            disabled={loading}
            onPress={verifyOTP}
            style={styles.button}>
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>
                Verify & Continue
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setOtp('');
              setStage('details');
            }}
            style={{marginTop: 22}}>
            <Text style={styles.changeEmail}>
              Change Email
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101827',
    justifyContent: 'center',
    padding: 25,
  },
  title: {
    color: 'white',
    fontSize: 38,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 40,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1E293B',
    color: 'white',
    padding: 16,
    borderRadius: 12,
    fontSize: 17,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  message: {
    color: 'white',
    textAlign: 'center',
    fontSize: 17,
    marginBottom: 20,
  },
  changeEmail: {
    color: '#93C5FD',
    textAlign: 'center',
  },
});
