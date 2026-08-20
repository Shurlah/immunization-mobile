import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getFacilities as getLocalFacilities, getLocalChildren, getVaccines as getLocalVaccines } from '../database/localDb';
import { fetchFacilities, fetchFacility, fetchVaccines, getApiErrorMessage, searchChildren } from '../services/apiClient';
import { saveImmunizationRecord } from '../services/offlineWrites';
import { recordImmunizationSchema } from '../shared/validation';
import type { AuthSession, ChildSummary, FacilityOption, VaccineOption } from '../shared/types';

const today = () => new Date().toISOString().slice(0, 10);

export function RecordImmunizationScreen({ session }: { session: AuthSession }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<ChildSummary[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildSummary | null>(null);

  const [vaccines, setVaccines] = useState<VaccineOption[]>([]);
  const [loadingVaccines, setLoadingVaccines] = useState(false);
  const [vaccineError, setVaccineError] = useState<string | null>(null);
  const [vaccineMenuOpen, setVaccineMenuOpen] = useState(false);

  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);

  const [form, setForm] = useState({
    vaccineId: '',
    doseName: '',
    dateAdministered: today(),
    facilityId: session.facilityId ?? ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadVaccines();
    void loadFacilities();
  }, []);

  async function loadVaccines() {
    setLoadingVaccines(true);
    setVaccineError(null);

    try {
      const localVaccines = await getLocalVaccines();
      setVaccines(localVaccines);

      try {
        const remoteVaccines = await fetchVaccines();
        setVaccines(mergeById(localVaccines, remoteVaccines));
      } catch (error) {
        console.warn('Failed to fetch vaccines from server:', getApiErrorMessage(error));
        if (localVaccines.length === 0) {
          setVaccineError(`Could not load vaccines: ${getApiErrorMessage(error)}`);
        }
      }
    } finally {
      setLoadingVaccines(false);
    }
  }

  async function loadFacilities() {
    setLoadingFacilities(true);
    setFacilityError(null);

    try {
      const localFacilities = await getLocalFacilities();
      let workingFacilities = withAssignedFacility(localFacilities, session.facilityId);
      setFacilities(workingFacilities);

      try {
        const remoteFacilities = await fetchFacilities();
        workingFacilities = withAssignedFacility(mergeById(localFacilities, remoteFacilities), session.facilityId);
      } catch {
        if (session.facilityId) {
          const assignedFacility = await fetchFacility(session.facilityId).catch(() => null);
          if (assignedFacility) {
            workingFacilities = mergeById(workingFacilities, [assignedFacility]);
          }
        }
      }

      setFacilities(workingFacilities);

      if (!form.facilityId && workingFacilities.length > 0) {
        setForm(current => ({ ...current, facilityId: session.facilityId ?? workingFacilities[0].id }));
      }
    } catch {
      setFacilityError('Could not load facilities.');
    } finally {
      setLoadingFacilities(false);
    }
  }

  async function search() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError(null);

    try {
      const remoteResults = await searchChildren({ q: trimmed, facilityId: session.facilityId ?? undefined });
      setResults(remoteResults);
      if (remoteResults.length === 0) {
        setSearchError('No children matched that search.');
      }
    } catch {
      try {
        const localResults = await getLocalChildren(trimmed);
        setResults(localResults);
        setSearchError(
          localResults.length > 0
            ? 'Showing offline matches only — connect to search all registered children.'
            : 'Could not reach the server, and no offline matches were found.'
        );
      } catch {
        setResults([]);
        setSearchError('Could not search for children.');
      }
    } finally {
      setSearching(false);
    }
  }

  function selectChild(child: ChildSummary) {
    setSelectedChild(child);
    setResults([]);
    setQuery('');
  }

  function changeChild() {
    setSelectedChild(null);
    setForm(current => ({ ...current, vaccineId: '', doseName: '' }));
  }

  async function submit() {
    if (!selectedChild) return;

    const result = recordImmunizationSchema.safeParse({
      childId: selectedChild.id,
      vaccineId: form.vaccineId,
      doseName: form.doseName.trim(),
      dateAdministered: form.dateAdministered,
      facilityId: form.facilityId,
      administeredByUserId: session.userId
    });

    if (!result.success) {
      const message = result.error.issues.map(issue => issue.message).join('\n');
      Alert.alert('Invalid form', message || 'Complete all required fields before saving.');
      return;
    }

    try {
      setSaving(true);
      await saveImmunizationRecord(result.data);
      Alert.alert('Saved offline', 'Vaccine dose was saved locally and queued for sync.');
      setForm({ vaccineId: '', doseName: '', dateAdministered: today(), facilityId: session.facilityId ?? form.facilityId });
      setSelectedChild(null);
    } catch (error) {
      Alert.alert('Save failed', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Record Vaccine</Text>

        {!selectedChild ? (
          <>
            <Text style={styles.label}>Find child</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={query}
                onChangeText={setQuery}
                placeholder="Name or caregiver phone"
                placeholderTextColor="#8b9892"
                onSubmitEditing={() => void search()}
              />
              <Pressable style={styles.searchButton} onPress={() => void search()} disabled={searching}>
                {searching ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.searchButtonText}>Search</Text>}
              </Pressable>
            </View>
            {searchError ? <Text style={styles.helper}>{searchError}</Text> : null}
            {results.length > 0 ? (
              <View style={styles.facilityList}>
                {results.map(child => (
                  <Pressable key={child.id} style={styles.facilityOption} onPress={() => selectChild(child)}>
                    <Text style={styles.facilityName}>{child.firstName} {child.lastName}</Text>
                    <Text style={styles.facilityCode}>
                      DOB {child.dateOfBirth} · {child.sex}
                      {child.guardianFullName ? ` · Guardian: ${child.guardianFullName}` : ''}
                      {child.guardianPhoneNumber ? ` (${child.guardianPhoneNumber})` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.selectedChildBanner}>
              <View>
                <Text style={styles.selectedChildName}>{selectedChild.firstName} {selectedChild.lastName}</Text>
                <Text style={styles.facilityCode}>DOB {selectedChild.dateOfBirth} · {selectedChild.sex}</Text>
              </View>
              <Pressable style={styles.retryButton} onPress={changeChild}>
                <Text style={styles.retryButtonText}>Change child</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Vaccine</Text>
            {loadingVaccines ? <Text style={styles.helper}>Loading vaccines...</Text> : null}
            {vaccineError ? (
              <View style={styles.facilityEmptyState}>
                <Text style={styles.helper}>{vaccineError}</Text>
                <Pressable style={styles.retryButton} onPress={() => void loadVaccines()}>
                  <Text style={styles.retryButtonText}>Retry vaccines</Text>
                </Pressable>
              </View>
            ) : null}
            <SelectField
              value={vaccines.find(v => v.id === form.vaccineId)?.name ?? 'Select vaccine'}
              open={vaccineMenuOpen}
              disabled={vaccines.length === 0}
              onToggle={() => setVaccineMenuOpen(current => !current)}
              options={vaccines.map(vaccine => ({ label: vaccine.name, value: vaccine.id }))}
              onSelect={value => {
                setForm({ ...form, vaccineId: value });
                setVaccineMenuOpen(false);
              }}
            />

            <Text style={styles.label}>Dose</Text>
            <TextInput
              style={styles.input}
              value={form.doseName}
              onChangeText={doseName => setForm({ ...form, doseName })}
              placeholder="e.g. Dose 1, OPV1"
              placeholderTextColor="#8b9892"
            />

            <Text style={styles.label}>Date administered</Text>
            <TextInput
              style={styles.input}
              value={form.dateAdministered}
              onChangeText={dateAdministered => setForm({ ...form, dateAdministered })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#8b9892"
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
              <Text style={styles.buttonText}>{saving ? 'Saving...' : '💉  Record dose'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
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

function mergeById<T extends { id: string; name: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();

  for (const item of [...local, ...remote]) {
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  searchInput: {
    flex: 1,
    marginBottom: 0
  },
  searchButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#19735f',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  selectedChildBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#19735f',
    backgroundColor: '#e9f6f1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14
  },
  selectedChildName: {
    color: '#0d5647',
    fontSize: 16,
    fontWeight: '800'
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
