import React, { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { AuthSession, DashboardState } from '../shared/types';
import { startSync } from '../services/syncService';
import { getDashboardState } from '../database/localDb';
import { getApiErrorMessage, logout } from '../services/apiClient';

export function HomeScreen({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [state, setState] = useState<DashboardState>({
    online: false,
    pendingCount: 0,
    failedCount: 0,
    childrenRegisteredToday: 0,
    appointmentsDueToday: 0
  });

  const refreshDashboard = useCallback(async (online?: boolean) => {
    const resolvedOnline = online ?? Boolean((await NetInfo.fetch()).isConnected);
    setState(await getDashboardState(resolvedOnline));
  }, []);

  const runSync = useCallback(async () => {
    try {
      setSyncing(true);
      const didSync = await startSync(session);
      await refreshDashboard();
      Alert.alert(didSync ? 'Sync complete' : 'Sync skipped', didSync ? 'Queued items were processed.' : 'Device is offline or a sync is already running.');
    } catch (error) {
      await refreshDashboard();
      Alert.alert('Sync failed', getApiErrorMessage(error));
    } finally {
      setSyncing(false);
    }
  }, [refreshDashboard, session]);

  const runLogout = useCallback(async () => {
    try {
      setLoggingOut(true);
      await logout();
      onLogout();
    } catch (error) {
      Alert.alert('Logout failed', getApiErrorMessage(error));
    } finally {
      setLoggingOut(false);
    }
  }, [onLogout]);

  useFocusEffect(
    useCallback(() => {
      void refreshDashboard();
    }, [refreshDashboard])
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(snapshot => {
      const online = Boolean(snapshot.isConnected);
      void refreshDashboard(online);
      if (online) void startSync(session).finally(() => refreshDashboard(online));
    });
    return unsubscribe;
  }, [refreshDashboard, session]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Today</Text>
      <View style={styles.status}><Text style={styles.statusText}>{state.online ? 'Online' : 'Offline'}</Text></View>
      <View style={styles.grid}>
        <Tile label="Pending sync" value={state.pendingCount} />
        <Tile label="Failed sync" value={state.failedCount} />
        <Tile label="Children today" value={state.childrenRegisteredToday} />
        <Tile label="Appointments due" value={state.appointmentsDueToday} />
      </View>
      {state.lastSuccessfulSyncAt ? (
        <Text style={styles.syncMeta}>Last sync: {new Date(state.lastSuccessfulSyncAt).toLocaleString()}</Text>
      ) : null}
      <Pressable style={[styles.button, syncing && styles.buttonDisabled]} disabled={syncing} onPress={runSync}>
        <Text style={styles.buttonText}>{syncing ? 'Syncing...' : 'Sync now'}</Text>
      </Pressable>
      <Pressable style={[styles.secondaryButton, loggingOut && styles.buttonDisabled]} disabled={loggingOut} onPress={runLogout}>
        <Text style={styles.secondaryButtonText}>{loggingOut ? 'Logging out...' : 'Logout'}</Text>
      </Pressable>
    </View>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return <View style={styles.tile}><Text style={styles.tileLabel}>{label}</Text><Text style={styles.tileValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, backgroundColor: '#f7faf6' },
  title: { fontSize: 32, fontWeight: '800', color: '#13211d' },
  status: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#dff2eb', marginVertical: 16 },
  statusText: { color: '#0a3028', fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', borderRadius: 8, padding: 16, backgroundColor: 'white', borderWidth: 1, borderColor: '#dbe5de' },
  tileLabel: { color: '#64726d', marginBottom: 10 },
  tileValue: { fontSize: 28, fontWeight: '800', color: '#13211d' },
  syncMeta: { color: '#64726d', marginTop: 16 },
  button: { marginTop: 18, borderRadius: 8, padding: 14, backgroundColor: '#0f6b57', alignItems: 'center' },
  secondaryButton: { marginTop: 10, borderRadius: 8, padding: 14, backgroundColor: 'white', borderWidth: 1, borderColor: '#d5ded8', alignItems: 'center' },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: 'white', fontWeight: '800' },
  secondaryButtonText: { color: '#38443f', fontWeight: '800' }
});
