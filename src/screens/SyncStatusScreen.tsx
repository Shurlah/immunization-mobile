import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function SyncStatusScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sync Status</Text>
      <Text style={styles.copy}>Pending, failed, conflict, and retryable sync items are stored in the local SyncQueue table.</Text>
      <Text style={styles.code}>Manual sync uses POST /api/sync/upload and GET /api/sync/download.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, backgroundColor: '#f7faf6' },
  title: { fontSize: 30, fontWeight: '800', color: '#13211d', marginBottom: 12 },
  copy: { color: '#64726d', lineHeight: 22 },
  code: { marginTop: 18, padding: 14, borderRadius: 8, backgroundColor: '#dff2eb', color: '#0a3028', fontWeight: '700' }
});
