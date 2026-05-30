import { router } from 'expo-router';

export const ADD_ENTRY_ROUTE = '/entry' as const;

export function navigateToAddEntry() {
  router.push(ADD_ENTRY_ROUTE);
}

export function navigateToEditEntry(entryId: string) {
  router.push({
    pathname: ADD_ENTRY_ROUTE,
    params: { entryId },
  });
}
