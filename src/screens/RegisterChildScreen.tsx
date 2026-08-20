import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getFacilities as getLocalFacilities } from '../database/localDb';
import { fetchFacilities, fetchFacility, getApiErrorMessage } from '../services/apiClient';
import { saveChildRegistration } from '../services/offlineWrites';
import { registerChildSchema } from '../shared/validation';
import type { AuthSession, FacilityOption } from '../shared/types';

const today = () => new Date().toISOString().slice(0, 10);

type SexOption = 'Male' | 'Female';

export function RegisterChildScreen({ session }: { session: AuthSession }) {
  const [form, setForm] = useState({
    caregiverName: '',
    caregiverPhoneNumber: '',
    relationshipToChild: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: today(),
    sex: 'Female' as SexOption,
    facilityId: session.facilityId ?? ''
  });
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [sexMenuOpen, setSexMenuOpen] = useState(false);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadFacilities();
  }, []);

  async function loadFacilities() {
    setLoadingFacilities(true);
    setFacilityError(null);

    try {
      const localFacilities = await getLocalFacilities();
      let workingFacilities = withAssignedFacility(localFacilities, session.facilityId);
      setFacilities(workingFacilities);

      try {
        const remoteFacilities = await fetchFacilities();
        workingFacilities = withAssignedFacility(mergeFacilities(localFacilities, remoteFacilities), session.facilityId);
      } catch {
        if (session.facilityId) {
          const assignedFacility = await fetchFacility(session.facilityId).catch(() => null);
          if (assignedFacility) {
            workingFacilities = mergeFacilities(workingFacilities, [assignedFacility]);
          }
        }
      }

      setFacilities(workingFacilities);

      if (!form.facilityId && workingFacilities.length > 0) {
        setForm(current => ({ ...current, facilityId: session.facilityId ?? workingFacilities[0].id }));
      }
    } catch {
      const localFacilities = await getLocalFacilities();
      const assignedFacility = session.facilityId ? await fetchFacility(session.facilityId).catch(() => null) : null;
      const fallbackFacilities = assignedFacility
        ? mergeFacilities(withAssignedFacility(localFacilities, session.facilityId), [assignedFacility])
        : withAssignedFacility(localFacilities, session.facilityId);
      setFacilities(fallbackFacilities);
      setFacilityError(fallbackFacilities.length > 0 ? null : 'Could not load facilities.');
    } finally {
      setLoadingFacilities(false);
    }
  }

  async function submit() {
    const result = registerChildSchema.safeParse({
      ...form,
      relationshipToChild: clean(form.relationshipToChild) ?? undefined,
      middleName: clean(form.middleName) ?? undefined,
      facilityId: form.facilityId,
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
        caregiverName: '',
        caregiverPhoneNumber: '',
        relationshipToChild: '',
        firstName: '',
        middleName: '',
        lastName: '',
        dateOfBirth: today(),
        sex: 'Female',
        facilityId: session.facilityId ?? form.facilityId
      });
      Alert.alert('Saved offline', 'Child registration was saved locally and queued for sync.');
    } catch (error) {
      Alert.alert('Save failed', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Register Child</Text>

        <Field label="Caregiver name" value={form.caregiverName} onChangeText={caregiverName => setForm({ ...form, caregiverName })} />
        <Field
          label="Caregiver phone"
          value={form.caregiverPhoneNumber}
          onChangeText={caregiverPhoneNumber => setForm({ ...form, caregiverPhoneNumber })}
          keyboardType="phone-pad"
        />
        <Field
          label="Relationship"
          value={form.relationshipToChild}
          onChangeText={relationshipToChild => setForm({ ...form, relationshipToChild })}
        />
        <Field label="Child first name" value={form.firstName} onChangeText={firstName => setForm({ ...form, firstName })} />
        <Field label="Middle name" value={form.middleName} onChangeText={middleName => setForm({ ...form, middleName })} />
        <Field label="Last name" value={form.lastName} onChangeText={lastName => setForm({ ...form, lastName })} />
        <Field
          label="Date of birth"
          value={form.dateOfBirth}
          onChangeText={dateOfBirth => setForm({ ...form, dateOfBirth })}
          placeholder="YYYY-MM-DD"
        />

        <Text style={styles.label}>Sex</Text>
        <SelectField
          value={form.sex}
          open={sexMenuOpen}
          onToggle={() => {
            setSexMenuOpen(current => !current);
          }}
          options={[
            { label: 'Female', value: 'Female' },
            { label: 'Male', value: 'Male' }
          ]}
          onSelect={value => {
            setForm({ ...form, sex: value as SexOption });
            setSexMenuOpen(false);
          }}
        />

        <Text style={styles.label}>Facility</Text>
        {loadingFacilities ? <Text style={styles.helper}>Loading facilities...</Text> : null}
        {!loadingFacilities && facilities.length > 0 ? (
          <View style={styles.facilityList}>
            {facilities.map(item => {
              const selected = item.id === form.facilityId;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.facilityOption, selected && styles.facilityOptionSelected]}
                  onPress={() => setForm({ ...form, facilityId: item.id })}
                >
                  <Text style={[styles.facilityName, selected && styles.facilityNameSelected]}>{item.name}</Text>
                  <Text style={[styles.facilityCode, selected && styles.facilityCodeSelected]}>{item.code}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {!loadingFacilities && facilities.length === 0 ? (
          <View style={styles.facilityEmptyState}>
            <Text style={styles.helper}>{facilityError ?? 'No facilities available for this account.'}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadFacilities()}>
              <Text style={styles.retryButtonText}>Retry facilities</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={submit}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : '+  Register child'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  placeholder?: string;
}) {
  return (
    <>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        placeholder={props.placeholder}
        placeholderTextColor="#8b9892"
      />
    </>
  );
}

function SelectField(props: {
  value: string;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  options: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.selectWrap}>
      <Pressable
        style={[styles.selectTrigger, props.disabled && styles.selectTriggerDisabled]}
        disabled={props.disabled}
        onPress={props.onToggle}
      >
        <Text style={styles.selectValue}>{props.value}</Text>
        <Text style={styles.selectChevron}>{props.open ? '˄' : '˅'}</Text>
      </Pressable>
      {props.open ? (
        <View style={styles.optionList}>
          {props.options.map(option => (
            <Pressable key={option.value} style={styles.optionRow} onPress={() => props.onSelect(option.value)}>
              <Text style={styles.optionText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function mergeFacilities(localFacilities: FacilityOption[], remoteFacilities: FacilityOption[]) {
  const byId = new Map<string, FacilityOption>();

  for (const item of [...localFacilities, ...remoteFacilities]) {
    byId.set(item.id, item);
  }

  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function withAssignedFacility(facilities: FacilityOption[], facilityId: string | null) {
  if (!facilityId || facilities.some(item => item.id === facilityId)) {
    return facilities;
  }

  return [{ id: facilityId, name: 'Assigned facility', code: facilityId.slice(0, 8).toUpperCase() }, ...facilities];
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const styles = StyleSheet.create({
  screen: {
    padding: 20,
    backgroundColor: '#f1f6f2'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d5e1da',
    padding: 20
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 18,
    color: '#13211d'
  },
  label: {
    color: '#5b6963',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d5e1da',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    color: '#13211d'
  },
  selectWrap: {
    marginBottom: 14
  },
  selectTrigger: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#d5e1da',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectTriggerDisabled: {
    opacity: 0.7
  },
  selectValue: {
    color: '#13211d',
    fontSize: 15
  },
  selectChevron: {
    color: '#13211d',
    fontSize: 16,
    fontWeight: '700'
  },
  optionList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d5e1da',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff'
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#eef2ef'
  },
  optionText: {
    color: '#13211d'
  },
  facilityList: {
    gap: 10,
    marginBottom: 14
  },
  facilityOption: {
    borderWidth: 1,
    borderColor: '#d5e1da',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#ffffff'
  },
  facilityOptionSelected: {
    borderColor: '#19735f',
    backgroundColor: '#e9f6f1'
  },
  facilityName: {
    color: '#13211d',
    fontSize: 15,
    fontWeight: '700'
  },
  facilityNameSelected: {
    color: '#0d5647'
  },
  facilityCode: {
    color: '#68756f',
    marginTop: 4,
    fontSize: 13
  },
  facilityCodeSelected: {
    color: '#19735f'
  },
  facilityEmptyState: {
    marginBottom: 14
  },
  helper: {
    color: '#68756f',
    marginBottom: 10
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d5e1da',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff'
  },
  retryButtonText: {
    color: '#13211d',
    fontWeight: '700'
  },
  button: {
    borderRadius: 10,
    paddingVertical: 15,
    backgroundColor: '#19735f',
    alignItems: 'center',
    marginTop: 6
  },
  buttonDisabled: {
    opacity: 0.65
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  }
});
