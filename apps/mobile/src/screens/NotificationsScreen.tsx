import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import type { AppNotification } from '@calendar-app/shared';
import { api } from '../lib/apiClient';

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ data: AppNotification[] }>('/api/notifications', { pageSize: 50 });
    setNotifications(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{new Date(item.scheduled_at).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fb' },
  empty: { textAlign: 'center', color: '#697386', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 13, color: '#4b5563', marginTop: 4 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
});
