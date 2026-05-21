import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import {
  FoodLogEntry,
  getCalorieTotal,
  getEntriesForLocalDay,
  getTimerEligibleEntries,
  useFoodLog,
} from '@/lib/food-log-store';
import { navigateToAddEntry, navigateToEditEntry } from '@/lib/entry-navigation';

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatElapsed(from: string, now: Date) {
  const elapsedMs = Math.max(0, now.getTime() - new Date(from).getTime());
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) {
    return 'Just now';
  }

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function describeCalories(entry: FoodLogEntry) {
  if (entry.calories === null) {
    return 'Calories unknown';
  }

  return `${entry.calories} cal`;
}

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { entries, isLoading, deleteEntry } = useFoodLog();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);

    return () => clearInterval(interval);
  }, []);

  const todayEntries = useMemo(() => getEntriesForLocalDay(entries, now), [entries, now]);
  const calorieTotal = useMemo(() => getCalorieTotal(todayEntries), [todayEntries]);
  const latestTimerEntry = getTimerEligibleEntries(entries)[0];

  function confirmDelete(entry: FoodLogEntry) {
    if (Platform.OS === 'web') {
      const shouldDelete = window.confirm(`${entry.name} will be removed from your log.`);

      if (shouldDelete) {
        deleteEntry(entry.id);
      }

      return;
    }

    Alert.alert('Delete entry?', `${entry.name} will be removed from your log.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEntry(entry.id);
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title">Today</ThemedText>
          <Pressable
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: theme.tint }]}
            onPress={navigateToAddEntry}>
            <ThemedText lightColor="#fff" darkColor="#11181C" style={styles.primaryButtonText}>
              Add
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metric, styles.metricDivider]}>
            <ThemedText style={styles.metricLabel}>Calories</ThemedText>
            <ThemedText style={styles.metricValue}>{calorieTotal}</ThemedText>
          </View>
          <View style={styles.metric}>
            <ThemedText style={styles.metricLabel}>Since food</ThemedText>
            <ThemedText style={styles.metricValue}>
              {latestTimerEntry ? formatElapsed(latestTimerEntry.eatenAt, now) : '--'}
            </ThemedText>
          </View>
        </View>

        {!latestTimerEntry ? (
          <ThemedText style={styles.timerNote}>No calorie-containing food logged yet.</ThemedText>
        ) : (
          <ThemedText style={styles.timerNote}>
            Last calorie-containing item at {formatTime(latestTimerEntry.eatenAt)}.
          </ThemedText>
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">Intake so far</ThemedText>
          <ThemedText style={styles.countText}>{todayEntries.length} logged</ThemedText>
        </View>

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator />
          </View>
        ) : todayEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">Nothing logged yet</ThemedText>
            <ThemedText style={styles.emptyCopy}>
              Add your first food, drink, or meal when you are ready.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.entryList}>
            {todayEntries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={styles.entryMain}>
                  <ThemedText type="defaultSemiBold" style={styles.entryName}>
                    {entry.name}
                  </ThemedText>
                  <ThemedText style={styles.entryMeta}>
                    {formatTime(entry.eatenAt)} · {describeCalories(entry)}
                  </ThemedText>
                </View>
                <View style={styles.entryActions}>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => navigateToEditEntry(entry.id)}>
                    <ThemedText style={[styles.actionText, { color: theme.tint }]}>Edit</ThemedText>
                  </Pressable>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => confirmDelete(entry)}>
                    <ThemedText style={styles.deleteText}>Delete</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 40,
    paddingTop: 72,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricsRow: {
    borderColor: '#D7DEE3',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  metric: {
    flex: 1,
    gap: 6,
    padding: 16,
  },
  metricDivider: {
    borderRightColor: '#D7DEE3',
    borderRightWidth: 1,
  },
  metricLabel: {
    color: '#687076',
    fontSize: 13,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  timerNote: {
    color: '#687076',
    marginTop: -12,
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countText: {
    color: '#687076',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    borderColor: '#D7DEE3',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 28,
  },
  emptyCopy: {
    color: '#687076',
    textAlign: 'center',
  },
  entryList: {
    borderColor: '#D7DEE3',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  entryRow: {
    alignItems: 'center',
    borderBottomColor: '#E8EDF0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  entryMain: {
    flex: 1,
    gap: 3,
  },
  entryName: {
    fontSize: 17,
  },
  entryMeta: {
    color: '#687076',
    fontSize: 14,
  },
  entryActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  actionText: {
    fontWeight: '700',
  },
  deleteText: {
    color: '#B42318',
    fontWeight: '700',
  },
});
