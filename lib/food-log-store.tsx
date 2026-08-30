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
const AUTOCOMPLETE_STORAGE_KEY = 'food-log.autocomplete.v1';

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

export type AutocompleteFood = {
  id: string;
  normalizedName: string;
  displayName: string;
  calories: number | null;
  createdAt: string;
  updatedAt: string;
};

type FoodLogContextValue = {
  entries: FoodLogEntry[];
  autocompleteFoods: AutocompleteFood[];
  isLoading: boolean;
  addEntry: (input: FoodLogInput) => Promise<FoodLogEntry>;
  updateEntry: (id: string, input: FoodLogInput) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  deleteAutocompleteFood: (id: string) => Promise<void>;
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

function isAutocompleteFood(value: unknown): value is AutocompleteFood {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const food = value as Partial<AutocompleteFood>;

  return (
    typeof food.id === 'string' &&
    typeof food.normalizedName === 'string' &&
    typeof food.displayName === 'string' &&
    (typeof food.calories === 'number' || food.calories === null) &&
    typeof food.createdAt === 'string' &&
    typeof food.updatedAt === 'string'
  );
}

function sortByNewest(entries: FoodLogEntry[]) {
  return [...entries].sort(
    (first, second) => new Date(second.eatenAt).getTime() - new Date(first.eatenAt).getTime()
  );
}

function sortAutocompleteFoods(foods: AutocompleteFood[]) {
  return [...foods].sort((first, second) => {
    const updatedAtDifference =
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();

    return updatedAtDifference || first.displayName.localeCompare(second.displayName);
  });
}

function normalizeFoodName(name: string) {
  return name.trim().toLowerCase();
}

export function getAutocompleteMatches(
  foods: AutocompleteFood[],
  query: string,
  limit: number
) {
  const normalizedQuery = normalizeFoodName(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  return foods
    .filter((food) => food.normalizedName.includes(normalizedQuery))
    .sort((first, second) => {
      const firstIsPrefixMatch = first.normalizedName.startsWith(normalizedQuery);
      const secondIsPrefixMatch = second.normalizedName.startsWith(normalizedQuery);

      if (firstIsPrefixMatch !== secondIsPrefixMatch) {
        return firstIsPrefixMatch ? -1 : 1;
      }

      const updatedAtDifference =
        new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();

      return updatedAtDifference || first.displayName.localeCompare(second.displayName);
    })
    .slice(0, limit);
}

export function FoodLogProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [autocompleteFoods, setAutocompleteFoods] = useState<AutocompleteFood[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      try {
        const [savedEntries, savedAutocompleteFoods] = await AsyncStorage.multiGet([
          STORAGE_KEY,
          AUTOCOMPLETE_STORAGE_KEY,
        ]);
        const parsedEntries = savedEntries[1] ? JSON.parse(savedEntries[1]) : [];
        const parsedAutocompleteFoods = savedAutocompleteFoods[1]
          ? JSON.parse(savedAutocompleteFoods[1])
          : [];

        if (Array.isArray(parsedEntries) && isMounted) {
          setEntries(sortByNewest(parsedEntries.filter(isFoodLogEntry)));
        }

        if (Array.isArray(parsedAutocompleteFoods) && isMounted) {
          setAutocompleteFoods(sortAutocompleteFoods(parsedAutocompleteFoods.filter(isAutocompleteFood)));
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

  const persistAutocompleteFoods = useCallback(async (nextFoods: AutocompleteFood[]) => {
    const sortedFoods = sortAutocompleteFoods(nextFoods);

    setAutocompleteFoods(sortedFoods);
    await AsyncStorage.setItem(AUTOCOMPLETE_STORAGE_KEY, JSON.stringify(sortedFoods));
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

      const normalizedName = normalizeFoodName(entry.name);
      const existingFood = autocompleteFoods.find(
        (food) => food.normalizedName === normalizedName
      );
      const nextAutocompleteFoods = existingFood
        ? autocompleteFoods.map((food) =>
            food.id === existingFood.id
              ? {
                  ...food,
                  displayName: entry.name,
                  calories: entry.calories,
                  updatedAt: now,
                }
              : food
          )
        : [
            ...autocompleteFoods,
            {
              id: createId(),
              normalizedName,
              displayName: entry.name,
              calories: entry.calories,
              createdAt: now,
              updatedAt: now,
            },
          ];

      await Promise.all([
        persistEntries([entry, ...entries]),
        persistAutocompleteFoods(nextAutocompleteFoods),
      ]);

      return entry;
    },
    [autocompleteFoods, entries, persistAutocompleteFoods, persistEntries]
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

  const deleteAutocompleteFood = useCallback(
    async (id: string) => {
      await persistAutocompleteFoods(autocompleteFoods.filter((food) => food.id !== id));
    },
    [autocompleteFoods, persistAutocompleteFoods]
  );

  const getEntry = useCallback(
    (id: string) => entries.find((entry) => entry.id === id),
    [entries]
  );

  const value = useMemo(
    () => ({
      entries,
      autocompleteFoods,
      isLoading,
      addEntry,
      updateEntry,
      deleteEntry,
      deleteAutocompleteFood,
      getEntry,
    }),
    [
      addEntry,
      autocompleteFoods,
      deleteAutocompleteFood,
      deleteEntry,
      entries,
      getEntry,
      isLoading,
      updateEntry,
    ]
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
