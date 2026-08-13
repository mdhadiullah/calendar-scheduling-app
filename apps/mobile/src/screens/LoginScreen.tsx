import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) Alert.alert('Sign in failed', error);
  }

  async function handleForgotPassword() {
    if (!email) return Alert.alert('Enter your email first');
    await supabase.auth.resetPasswordForEmail(email);
    Alert.alert('Check your email', 'A password reset link has been sent.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📆 Calendar & Scheduling</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleForgotPassword}>
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Accounts are created by your administrator. Contact them if you don't have one yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f7f8fb' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#697386', marginBottom: 24 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  button: { backgroundColor: '#4F46E5', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { color: '#4F46E5', textAlign: 'center', marginTop: 16, fontSize: 13 },
  footer: { fontSize: 12, color: '#697386', textAlign: 'center', marginTop: 32 },
});
