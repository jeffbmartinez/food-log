import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { FoodLogEntry, useFoodLog } from '@/lib/food-log-store';

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return null;
  }

  return parsed;
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getDefaultFormState(entry?: FoodLogEntry) {
  const date = entry ? new Date(entry.eatenAt) : new Date();

  return {
    name: entry?.name ?? '',
    calories: entry?.calories === null || entry?.calories === undefined ? '' : String(entry.calories),
    dateValue: toDateValue(date),
    timeValue: toTimeValue(date),
  };
}

export default function FoodInputScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const normalizedEntryId = getParamValue(entryId);
  const { addEntry, getEntry, updateEntry } = useFoodLog();
  const editingEntry = useMemo(
    () => (normalizedEntryId ? getEntry(normalizedEntryId) : undefined),
    [getEntry, normalizedEntryId]
  );
  const isEditing = Boolean(normalizedEntryId);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [dateValue, setDateValue] = useState(toDateValue(new Date()));
  const [timeValue, setTimeValue] = useState(toTimeValue(new Date()));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = useCallback((entry?: FoodLogEntry) => {
    const defaultState = getDefaultFormState(entry);

    setName(defaultState.name);
    setCalories(defaultState.calories);
    setDateValue(defaultState.dateValue);
    setTimeValue(defaultState.timeValue);
    setError('');
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!normalizedEntryId) {
        resetForm();
      }
    }, [normalizedEntryId, resetForm])
  );

  useEffect(() => {
    if (normalizedEntryId && editingEntry) {
      resetForm(editingEntry);
    }
  }, [editingEntry, normalizedEntryId, resetForm]);

  async function saveEntry() {
    const trimmedName = name.trim();
    const trimmedCalories = calories.trim();
    const parsedCalories = trimmedCalories === '' ? null : Number(trimmedCalories);
    const parsedDate = parseLocalDateTime(dateValue.trim(), timeValue.trim());

    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    if (
      trimmedCalories !== '' &&
      (!Number.isFinite(parsedCalories) || parsedCalories === null || parsedCalories < 0)
    ) {
      setError('Calories must be a non-negative number.');
      return;
    }

    if (!parsedDate) {
      setError('Use a valid date and 24-hour time.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const input = {
        name: trimmedName,
        calories: parsedCalories,
        eatenAt: parsedDate,
      };

      if (isEditing && normalizedEntryId) {
        await updateEntry(normalizedEntryId, input);
      } else {
        await addEntry(input);
      }

      resetForm();
      router.replace('/');
    } catch (saveError) {
      console.warn('Unable to save entry', saveError);
      Alert.alert('Save failed', 'Your entry could not be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title">{isEditing ? 'Edit entry' : 'Add entry'}</ThemedText>
            {isEditing ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.replace('/')}>
                <ThemedText style={[styles.cancelText, { color: theme.tint }]}>Cancel</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {isEditing && !editingEntry ? (
            <View style={styles.emptyState}>
              <ThemedText type="subtitle">Entry not found</ThemedText>
              <ThemedText style={styles.helpText}>It may have already been deleted.</ThemedText>
              <Pressable
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: theme.tint }]}
                onPress={() => router.replace('/')}>
                <ThemedText lightColor="#fff" darkColor="#11181C" style={styles.primaryButtonText}>
                  Back to Today
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.field}>
                <ThemedText type="defaultSemiBold">Name</ThemedText>
                <TextInput
                  autoCapitalize="sentences"
                  placeholder="Food, drink, or meal"
                  placeholderTextColor="#8A939B"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.field}>
                <ThemedText type="defaultSemiBold">Calories</ThemedText>
                <TextInput
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  placeholderTextColor="#8A939B"
                  style={styles.input}
                  value={calories}
                  onChangeText={setCalories}
                />
                <ThemedText style={styles.helpText}>
                  Blank means unknown. Zero is valid, but does not reset the timer.
                </ThemedText>
              </View>

              <View style={styles.timeRow}>
                <View style={[styles.field, styles.timeField]}>
                  <ThemedText type="defaultSemiBold">Date</ThemedText>
                  <TextInput
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#8A939B"
                    style={styles.input}
                    value={dateValue}
                    onChangeText={setDateValue}
                  />
                </View>

                <View style={[styles.field, styles.timeField]}>
                  <ThemedText type="defaultSemiBold">Time</ThemedText>
                  <TextInput
                    placeholder="HH:mm"
                    placeholderTextColor="#8A939B"
                    style={styles.input}
                    value={timeValue}
                    onChangeText={setTimeValue}
                  />
                </View>
              </View>

              {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                style={[styles.primaryButton, { backgroundColor: theme.tint, opacity: isSaving ? 0.65 : 1 }]}
                onPress={saveEntry}>
                <ThemedText lightColor="#fff" darkColor="#11181C" style={styles.primaryButtonText}>
                  {isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Save entry'}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    gap: 24,
    padding: 20,
    paddingBottom: 40,
    paddingTop: 72,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#D7DEE3',
    borderRadius: 8,
    borderWidth: 1,
    color: '#11181C',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  helpText: {
    color: '#687076',
    fontSize: 14,
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  errorText: {
    color: '#B42318',
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    borderColor: '#D7DEE3',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 28,
  },
});
