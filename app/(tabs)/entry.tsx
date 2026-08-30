import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import {
  AutocompleteFood,
  FoodLogEntry,
  getAutocompleteMatches,
  useFoodLog,
} from '@/lib/food-log-store';

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
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const normalizedEntryId = getParamValue(entryId);
  const {
    addEntry,
    autocompleteFoods,
    deleteAutocompleteFood,
    getEntry,
    updateEntry,
  } = useFoodLog();
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
  const [isAutocompleteDismissed, setIsAutocompleteDismissed] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const autocompleteLimit = height >= 900 ? 5 : height < 700 ? 2 : 3;
  const autocompleteMatches = useMemo(
    () => getAutocompleteMatches(autocompleteFoods, name, autocompleteLimit),
    [autocompleteFoods, autocompleteLimit, name]
  );
  const shouldShowAutocomplete =
    !isEditing && !isAutocompleteDismissed && autocompleteMatches.length > 0;

  const resetForm = useCallback((entry?: FoodLogEntry) => {
    const defaultState = getDefaultFormState(entry);

    setName(defaultState.name);
    setCalories(defaultState.calories);
    setDateValue(defaultState.dateValue);
    setTimeValue(defaultState.timeValue);
    setError('');
    setIsAutocompleteDismissed(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (normalizedEntryId) {
        const entry = getEntry(normalizedEntryId);
        if (entry) {
          resetForm(entry);
        }
      } else {
        resetForm();
        const focusFrame = requestAnimationFrame(() => nameInputRef.current?.focus());

        return () => cancelAnimationFrame(focusFrame);
      }
    }, [getEntry, normalizedEntryId, resetForm])
  );

  useEffect(() => {
    if (normalizedEntryId && editingEntry) {
      resetForm(editingEntry);
    }
  }, [editingEntry, normalizedEntryId, resetForm]);

  function selectAutocompleteFood(food: AutocompleteFood) {
    setName(food.displayName);
    setCalories(food.calories === null ? '' : String(food.calories));
    setError('');
    setIsAutocompleteDismissed(true);
    nameInputRef.current?.blur();
  }

  function removeAutocompleteFood(food: AutocompleteFood) {
    async function removeFood() {
      try {
        await deleteAutocompleteFood(food.id);
      } catch (deleteError) {
        console.warn('Unable to remove autocomplete food', deleteError);
        Alert.alert(
          'Remove failed',
          'This suggestion could not be removed. Please try again.'
        );
      }
    }

    const message = 'This won’t delete any food-log entries.';

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove “${food.displayName}” from suggestions?\n\n${message}`)) {
        void removeFood();
      }

      return;
    }

    Alert.alert(`Remove “${food.displayName}” from suggestions?`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removeFood(),
      },
    ]);
  }

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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
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
                  ref={nameInputRef}
                  style={styles.input}
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    setError('');
                    setIsAutocompleteDismissed(false);
                  }}
                  onBlur={() => setIsAutocompleteDismissed(true)}
                  onFocus={() => setIsAutocompleteDismissed(false)}
                />
                {shouldShowAutocomplete ? (
                  <View
                    accessibilityLabel="Food suggestions"
                    accessibilityRole="list"
                    style={styles.autocompletePanel}>
                    <ScrollView
                      keyboardShouldPersistTaps="always"
                      nestedScrollEnabled
                      style={styles.autocompleteScroll}>
                      {autocompleteMatches.map((food) => (
                        <View key={food.id} style={styles.autocompleteRow}>
                          <Pressable
                            accessibilityLabel={
                              food.calories === null
                                ? `Use ${food.displayName}`
                                : `Use ${food.displayName}, ${food.calories} calories`
                            }
                            accessibilityRole="button"
                            onPress={() => selectAutocompleteFood(food)}
                            style={styles.autocompleteSelect}>
                            <ThemedText numberOfLines={1} style={styles.autocompleteName}>
                              {food.displayName}
                            </ThemedText>
                            {food.calories === null ? null : (
                              <ThemedText style={styles.autocompleteCalories}>
                                {food.calories} cal
                              </ThemedText>
                            )}
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`Remove ${food.displayName} from suggestions`}
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={() => removeAutocompleteFood(food)}
                            style={styles.removeSuggestionButton}>
                            <ThemedText style={styles.removeSuggestionText}>Remove</ThemedText>
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
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

            </View>
          )}
        </ScrollView>
        {(!isEditing || editingEntry) ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.background,
                borderTopColor: colorScheme === 'dark' ? '#3B4248' : '#D7DEE3',
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.tint, opacity: isSaving ? 0.65 : 1 },
              ]}
              onPress={saveEntry}>
              <ThemedText lightColor="#fff" darkColor="#11181C" style={styles.primaryButtonText}>
                {isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Save entry'}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
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
    paddingBottom: 24,
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
  autocompletePanel: {
    borderColor: '#D7DEE3',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 184,
    overflow: 'hidden',
  },
  autocompleteScroll: {
    maxHeight: 182,
  },
  autocompleteRow: {
    alignItems: 'stretch',
    borderBottomColor: '#D7DEE3',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  autocompleteSelect: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
    paddingHorizontal: 14,
  },
  autocompleteName: {
    flex: 1,
  },
  autocompleteCalories: {
    color: '#687076',
    fontSize: 14,
  },
  removeSuggestionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: 10,
  },
  removeSuggestionText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '700',
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
  footer: {
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
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
