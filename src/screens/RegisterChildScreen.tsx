import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { saveChildRegistration } from '../services/offlineWrites';
import { registerChildSchema } from '../shared/validation';
import type { AuthSession } from '../shared/types';

export function RegisterChildScreen({ session }: { session: AuthSession }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    sex: 'Male' as 'Male' | 'Female',
    caregiverName: '',
    caregiverPhoneNumber: ''
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    const result = registerChildSchema.safeParse({
      ...form,
      facilityId: session.facilityId,
      healthWorkerId: session.userId
    });
    if (!result.success) {
      const message = result.error.issues.map(issue => issue.message).join('\n');
      Alert.alert('Invalid form', message || 'Complete all required fields before saving.');
      return;
    }
    try {
      setSaving(true);
      await saveChildRegistration(result.data);
      setForm({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        sex: 'Male',
        caregiverName: '',
        caregiverPhoneNumber: ''
      });
      Alert.alert('Saved offline', 'Child registration was saved locally and queued for sync.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save child registration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Register Child</Text>
      <Field label="First name" value={form.firstName} onChangeText={firstName => setForm({ ...form, firstName })} />
      <Field label="Last name" value={form.lastName} onChangeText={lastName => setForm({ ...form, lastName })} />
      <Field label="Date of birth (YYYY-MM-DD)" value={form.dateOfBirth} onChangeText={dateOfBirth => setForm({ ...form, dateOfBirth })} />
      <Field label="Caregiver name" value={form.caregiverName} onChangeText={caregiverName => setForm({ ...form, caregiverName })} />
      <Field label="Caregiver phone" value={form.caregiverPhoneNumber} onChangeText={caregiverPhoneNumber => setForm({ ...form, caregiverPhoneNumber })} />
      <Pressable style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={submit}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save offline'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void }) {
  return <><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} {...props} /></>;
}

const styles = StyleSheet.create({
  screen: { padding: 20, backgroundColor: '#f7faf6' },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 18, color: '#13211d' },
  label: { color: '#64726d', marginBottom: 6, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#dbe5de', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: 'white' },
  button: { borderRadius: 8, padding: 14, backgroundColor: '#0f6b57', alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: 'white', fontWeight: '800' }
});
