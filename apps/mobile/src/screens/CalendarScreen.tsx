import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import type { CalendarEvent } from '@calendar-app/shared';
import { api } from '../lib/apiClient';

function groupByDay(events: CalendarEvent[]) {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const key = new Date(e.start_at).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return Object.entries(groups).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
}

export function CalendarScreen() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const start = new Date();
    const end = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    const res = await api.get<{ data: CalendarEvent[] }>('/api/events', { start: start.toISOString(), end: end.toISOString() });
    setEvents(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const groups = groupByDay(events);

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={([day]) => day}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming events in the next 30 days.</Text>}
        renderItem={({ item: [day, dayEvents] }) => (
          <View style={styles.dayGroup}>
            <Text style={styles.dayLabel}>{new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            {dayEvents.map((e) => (
              <View key={e.id} style={[styles.eventCard, { borderLeftColor: e.color ?? '#4F46E5' }]}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.eventTime}>
                  {e.all_day ? 'All day' : `${new Date(e.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(e.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </Text>
                {e.location ? <Text style={styles.eventMeta}>📍 {e.location}</Text> : null}
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fb' },
  empty: { textAlign: 'center', color: '#697386', marginTop: 40 },
  dayGroup: { marginBottom: 20 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: '#697386', textTransform: 'uppercase', marginBottom: 8 },
  eventCard: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  eventTitle: { fontSize: 15, fontWeight: '700' },
  eventTime: { fontSize: 13, color: '#697386', marginTop: 2 },
  eventMeta: { fontSize: 12, color: '#697386', marginTop: 2 },
});
