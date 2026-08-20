import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login } from '../services/apiClient';
import type { AuthSession } from '../shared/types';

export function LoginScreen({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [email, setEmail] = useState('worker@example.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);

  async function submit() {
    try {
      onLogin(await login(email, password));
    } catch {
      Alert.alert('Login failed', 'Check credentials and API connectivity.');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.kicker}>Offline-first immunization</Text>
      <Text style={styles.title}>Health Worker Login</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" placeholderTextColor="#7b8781" />
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          placeholder="Password"
          placeholderTextColor="#7b8781"
        />
        <Pressable style={styles.showButton} onPress={() => setShowPassword(current => !current)}>
          <Text style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.button} onPress={submit}><Text style={styles.buttonText}>Sign in</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f7faf6' },
  kicker: { color: '#0f6b57', fontWeight: '800', marginBottom: 8 },
  title: { fontSize: 34, fontWeight: '800', color: '#13211d', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#dbe5de', borderRadius: 8, padding: 14, marginBottom: 12, backgroundColor: 'white', color: '#13211d' },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 70 },
  showButton: { position: 'absolute', right: 6, top: 6, bottom: 18, paddingHorizontal: 12, justifyContent: 'center' },
  showButtonText: { color: '#0f6b57', fontWeight: '800' },
  button: { borderRadius: 8, padding: 14, backgroundColor: '#0f6b57', alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '800' }
});
