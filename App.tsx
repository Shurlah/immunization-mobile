import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeDatabase } from './src/database/localDb';
import { loadSession } from './src/services/apiClient';
import type { AuthSession } from './src/shared/types';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RecordImmunizationScreen } from './src/screens/RecordImmunizationScreen';
import { RegisterChildScreen } from './src/screens/RegisterChildScreen';
import { SyncStatusScreen } from './src/screens/SyncStatusScreen';

const Tab = createBottomTabNavigator();

const tabIcons = {
  Home: '⌂',
  Register: '+',
  RecordVaccine: '💉',
  Sync: '↻'
};

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void initializeDatabase()
      .then(loadSession)
      .then(storedSession => setSession(storedSession))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (!session) return <LoginScreen onLogin={setSession} />;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#0f766e',
            tabBarInactiveTintColor: '#7b8781',
            tabBarIcon: ({ color, size }) => {
              const icon = tabIcons[route.name as keyof typeof tabIcons];
              return <Text style={{ color, fontSize: size, fontWeight: '700' }}>{icon}</Text>;
            }
          })}
        >
          <Tab.Screen name="Home">{() => <HomeScreen session={session} onLogout={() => setSession(null)} />}</Tab.Screen>
          <Tab.Screen name="Register">{() => <RegisterChildScreen session={session} />}</Tab.Screen>
          <Tab.Screen name="RecordVaccine" options={{ title: 'Record Vaccine' }}>
            {() => <RecordImmunizationScreen session={session} />}
          </Tab.Screen>
          <Tab.Screen name="Sync" component={SyncStatusScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
