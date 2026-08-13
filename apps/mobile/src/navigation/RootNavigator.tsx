import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { isLicenseUsable } from '@calendar-app/shared';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { MainTabs } from './MainTabs';
import { CreateMenuScreen } from '../screens/CreateMenuScreen';
import { CreateFormScreen } from '../screens/CreateFormScreen';

export type RootStackParamList = {
  Tabs: undefined;
  CreateMenu: undefined;
  CreateForm: { type: 'event' | 'meeting' | 'task' | 'reminder' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, profile, access, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session || !profile) {
    return (
      <NavigationContainer>
        <LoginScreen />
      </NavigationContainer>
    );
  }

  if (profile.status === 'LOCKED' || profile.status === 'SUSPENDED') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
          {profile.status === 'LOCKED' ? 'Your account is locked' : 'Your account is suspended'}
        </Text>
        <Text style={{ color: '#697386', textAlign: 'center' }}>Contact your administrator for details.</Text>
      </View>
    );
  }

  if (profile.role !== 'ADMIN' && access && !isLicenseUsable(access.license_status)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Your trial has ended</Text>
        <Text style={{ color: '#697386', textAlign: 'center' }}>Contact your administrator to activate your account.</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs">
          {({ navigation }) => <MainTabs onCreatePress={() => navigation.navigate('CreateMenu')} />}
        </Stack.Screen>
        <Stack.Group screenOptions={{ presentation: 'modal', headerShown: false }}>
          <Stack.Screen name="CreateMenu" component={CreateMenuScreen} />
          <Stack.Screen name="CreateForm" component={CreateFormScreen} options={{ headerShown: true }} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
