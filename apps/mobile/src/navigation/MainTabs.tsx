import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { CalendarScreen } from '../screens/CalendarScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

export type MainTabParamList = {
  Calendar: undefined;
  Tasks: undefined;
  CreateTab: undefined; // intercepted — see tabPress listener below
  Notifications: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// A no-op placeholder screen for the center "+" tab — its tabPress event is
// intercepted (see RootNavigator) to open the CreateMenu modal instead of
// navigating here.
function CreatePlaceholder() {
  return null;
}

const ICONS: Record<keyof MainTabParamList, string> = {
  Calendar: '📅',
  Tasks: '✅',
  CreateTab: '➕',
  Notifications: '🔔',
  Profile: '👤',
};

export function MainTabs({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitle: route.name === 'CreateTab' ? '' : route.name,
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name as keyof MainTabParamList]}</Text>,
        tabBarActiveTintColor: '#4F46E5',
      })}
    >
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen
        name="CreateTab"
        component={CreatePlaceholder}
        options={{ tabBarLabel: 'Create' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            onCreatePress();
          },
        }}
      />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
