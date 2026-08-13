import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateMenu'>;

const OPTIONS: { type: 'event' | 'meeting' | 'task' | 'reminder'; label: string; icon: string }[] = [
  { type: 'event', label: 'New Event', icon: '📅' },
  { type: 'meeting', label: 'New Meeting', icon: '🤝' },
  { type: 'task', label: 'New Task', icon: '✅' },
  { type: 'reminder', label: 'Reminder', icon: '⏰' },
];

export function CreateMenuScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>Create</Text>
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.type}
          style={styles.option}
          onPress={() => navigation.replace('CreateForm', { type: opt.type })}
        >
          <Text style={styles.optionIcon}>{opt.icon}</Text>
          <Text style={styles.optionLabel}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: '#e4e7ec', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f1f4' },
  optionIcon: { fontSize: 20, marginRight: 12 },
  optionLabel: { fontSize: 16, fontWeight: '600' },
});
