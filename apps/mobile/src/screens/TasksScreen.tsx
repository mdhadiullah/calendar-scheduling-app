import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import type { Task, TaskStatus } from '@calendar-app/shared';
import { api } from '../lib/apiClient';

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: 'TODO',
  CANCELLED: 'TODO',
};

const PRIORITY_COLOR: Record<string, string> = { LOW: '#e5e7eb', MEDIUM: '#dbeafe', HIGH: '#fef3c7', URGENT: '#fee2e2' };

export function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ data: Task[] }>('/api/tasks');
    setTasks(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function advance(task: Task) {
    await api.patch(`/api/tasks/${task.id}`, { status: NEXT_STATUS[task.status] });
    load();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No tasks yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { backgroundColor: PRIORITY_COLOR[item.priority] ?? '#fff' }]} onPress={() => advance(item)}>
            <Text style={styles.title}>{item.title}</Text>
            {item.due_at && <Text style={styles.meta}>Due {new Date(item.due_at).toLocaleString()}</Text>}
            <Text style={styles.status}>{item.status.replace('_', ' ')} · tap to advance</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fb' },
  empty: { textAlign: 'center', color: '#697386', marginTop: 40 },
  card: { borderRadius: 8, padding: 14, marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, color: '#4b5563', marginTop: 4 },
  status: { fontSize: 11, color: '#6b7280', marginTop: 6, textTransform: 'uppercase' },
});
