import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { api } from '../lib/apiClient';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateForm'>;

const TITLES: Record<Props['route']['params']['type'], string> = {
  event: 'New Event',
  meeting: 'New Meeting',
  task: 'New Task',
  reminder: 'New Reminder',
};

// A deliberately simple mobile-first form: title + date/time (as text, to
// avoid pulling in a native date picker dependency for this reference
// implementation) + optional notes. Covers the "+" quick-create flow from
// the spec; richer editing (participants, recurrence, etc.) happens on web
// and desktop where there's more screen space.
export function CreateFormScreen({ route, navigation }: Props) {
  const { type } = route.params;
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return Alert.alert('Title is required');
    const startAt = when ? new Date(when) : new Date(Date.now() + 30 * 60_000);
    if (isNaN(startAt.getTime())) return Alert.alert('Enter date/time as YYYY-MM-DD HH:mm');

    setSaving(true);
    try {
      if (type === 'event') {
        // A default personal calendar is required; in this simplified
        // mobile flow we fetch the user's first calendar.
        const calendars = await api.get<{ data: { id: string }[] }>('/api/calendars');
        const calendarId = calendars.data[0]?.id;
        if (!calendarId) throw new Error('Create a calendar on web first');
        await api.post('/api/events', {
          calendar_id: calendarId,
          title,
          description: notes || undefined,
          start_at: startAt.toISOString(),
          end_at: new Date(startAt.getTime() + 60 * 60_000).toISOString(),
          all_day: false,
          timezone: 'UTC',
        });
      } else if (type === 'meeting') {
        await api.post('/api/meetings', {
          title,
          description: notes || undefined,
          start_at: startAt.toISOString(),
          end_at: new Date(startAt.getTime() + 60 * 60_000).toISOString(),
          timezone: 'UTC',
        });
      } else if (type === 'task') {
        await api.post('/api/tasks', { title, description: notes || undefined, due_at: when ? startAt.toISOString() : undefined, priority: 'MEDIUM' });
      } else {
        Alert.alert('Reminders', 'Create a reminder against an existing event/meeting/task from the web app for now.');
        navigation.goBack();
        return;
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{TITLES[type]}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Give it a name" />

      <Text style={styles.label}>When (YYYY-MM-DD HH:mm)</Text>
      <TextInput style={styles.input} value={when} onChangeText={setWhen} placeholder="2026-08-20 14:00" />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, { height: 90 }]} value={notes} onChangeText={setNotes} multiline placeholder="Optional details" />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#697386', marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 8, padding: 12, fontSize: 15 },
  button: { backgroundColor: '#4F46E5', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: '700' },
  cancel: { alignItems: 'center', marginTop: 12 },
  cancelText: { color: '#697386' },
});
