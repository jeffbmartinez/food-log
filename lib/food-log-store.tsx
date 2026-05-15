import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'food-log.entries.v1';

export type FoodLogEntry = {
  id: string;
  name: string;
  calories: number | null;
  eatenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type FoodLogInput = {
  name: string;
  calories: number | null;
  eatenAt: Date;
};

type FoodLogContextValue = {
  entries: FoodLogEntry[];
  isLoading: boolean;
  addEntry: (input: FoodLogInput) => Promise<FoodLogEntry>;
  updateEntry: (id: string, input: FoodLogInput) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  getEntry: (id: string) => FoodLogEntry | undefined;
};

const FoodLogContext = createContext<FoodLogContextValue | null>(null);

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isFoodLogEntry(value: unknown): value is FoodLogEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<FoodLogEntry>;

  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    (typeof entry.calories === 'number' || entry.calories === null) &&
    typeof entry.eatenAt === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.updatedAt === 'string'
  );
}

function sortByNewest(entries: FoodLogEntry[]) {
  return [...entries].sort(
    (first, second) => new Date(second.eatenAt).getTime() - new Date(first.eatenAt).getTime()
  );
}

export function FoodLogProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      try {
        const savedEntries = await AsyncStorage.getItem(STORAGE_KEY);
        const parsedEntries = savedEntries ? JSON.parse(savedEntries) : [];

        if (Array.isArray(parsedEntries) && isMounted) {
          setEntries(sortByNewest(parsedEntries.filter(isFoodLogEntry)));
        }
      } catch (error) {
        console.warn('Unable to load food log entries', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadEntries();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistEntries = useCallback(async (nextEntries: FoodLogEntry[]) => {
    const sortedEntries = sortByNewest(nextEntries);

    setEntries(sortedEntries);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sortedEntries));
  }, []);

  const addEntry = useCallback(
    async (input: FoodLogInput) => {
      const now = new Date().toISOString();
      const entry: FoodLogEntry = {
        id: createId(),
        name: input.name.trim(),
        calories: input.calories,
        eatenAt: input.eatenAt.toISOString(),
        createdAt: now,
        updatedAt: now,
      };

      await persistEntries([entry, ...entries]);

      return entry;
    },
    [entries, persistEntries]
  );

  const updateEntry = useCallback(
    async (id: string, input: FoodLogInput) => {
      const updatedEntries = entries.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }

        return {
          ...entry,
          name: input.name.trim(),
          calories: input.calories,
          eatenAt: input.eatenAt.toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      await persistEntries(updatedEntries);
    },
    [entries, persistEntries]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await persistEntries(entries.filter((entry) => entry.id !== id));
    },
    [entries, persistEntries]
  );

  const getEntry = useCallback(
    (id: string) => entries.find((entry) => entry.id === id),
    [entries]
  );

  const value = useMemo(
    () => ({
      entries,
      isLoading,
      addEntry,
      updateEntry,
      deleteEntry,
      getEntry,
    }),
    [addEntry, deleteEntry, entries, getEntry, isLoading, updateEntry]
  );

  return <FoodLogContext.Provider value={value}>{children}</FoodLogContext.Provider>;
}

export function useFoodLog() {
  const context = useContext(FoodLogContext);

  if (!context) {
    throw new Error('useFoodLog must be used within a FoodLogProvider');
  }

  return context;
}

export function getEntriesForLocalDay(entries: FoodLogEntry[], date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return sortByNewest(
    entries.filter((entry) => {
      const eatenAt = new Date(entry.eatenAt).getTime();

      return eatenAt >= startOfDay.getTime() && eatenAt < endOfDay.getTime();
    })
  );
}

export function getTimerEligibleEntries(entries: FoodLogEntry[]) {
  return entries.filter((entry) => typeof entry.calories === 'number' && entry.calories > 0);
}

export function getCalorieTotal(entries: FoodLogEntry[]) {
  return entries.reduce((total, entry) => total + (entry.calories ?? 0), 0);
}
