import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { trialDaysRemaining, licenseStatusLabel } from '@calendar-app/shared';
import { useAuth } from '../contexts/AuthContext';

export function ProfileScreen() {
  const { profile, access, signOut } = useAuth();
  const remaining = access ? trialDaysRemaining(access) : null;

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{profile?.full_name?.slice(0, 1).toUpperCase() ?? '?'}</Text>
      </View>
      <Text style={styles.name}>{profile?.full_name}</Text>
      <Text style={styles.email}>{profile?.email}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{profile?.role}</Text>
      </View>
      {access && (
        <View style={styles.section}>
          <Text style={styles.label}>License</Text>
          <Text style={styles.value}>
            {licenseStatusLabel(access.license_status)}
            {remaining !== null ? ` — ${remaining}d remaining` : ''}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fb', alignItems: 'center', padding: 24, paddingTop: 48 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 13, color: '#697386', marginBottom: 24 },
  section: { width: '100%', backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 10 },
  label: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' },
  value: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  button: { marginTop: 24, backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
