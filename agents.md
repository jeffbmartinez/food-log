# Agent Guide

This is an Expo React Native food logging app. Keep changes small, typed, and consistent with the existing Expo Router structure.

## Project Shape

- `app/` contains file-based routes. The tab screens live in `app/(tabs)/`.
- `app/_layout.tsx` wires global providers and navigation.
- `lib/food-log-store.tsx` owns food log state, persistence, validation helpers, and derived totals.
- `components/` contains reusable themed UI primitives and small platform helpers.
- `constants/theme.ts` defines shared light and dark color tokens.

## Commands

- Install dependencies: `npm install`
- Start native/web development server: `npm start`
- Start web directly: `npm run web`
- Lint: `npm run lint`
- Find unused files, exports, and dependencies: `npm run knip`

Run `npm run lint` before handing off code changes when feasible. Run `npm run knip` when dependency, export, or file usage changes are part of the work.

## Running Servers

- If a manual run is better for the user, share the exact commands and brief instructions instead of starting the service yourself.
- It is fine for an agent to start the Expo dev server for smoke tests or visual verification.
- When an agent starts a server or long-running process, it must stop that process before handing off.
- Do not leave Expo, Metro, web servers, watchers, or other background processes running after verification is complete.
- If a server was already running before the agent began work, do not stop it unless the user asks.

## Coding Defaults

- Use TypeScript and function components.
- Follow the existing import alias style (`@/...`) for project files.
- Prefer local, focused helpers near the screen or module that uses them.
- Keep food log data access in `lib/food-log-store.tsx`; screens should consume the provider hook rather than reading persistence directly.
- Persist food log entries through AsyncStorage using serializable values only.
- Treat `calories: null` as unknown calories. Zero is valid, but should not count as timer-eligible food.
- Store timestamps as ISO strings and convert to `Date` objects only at the UI or calculation boundary.
- Preserve sorting by newest eaten time for displayed entries.

## UI Defaults

- Use React Native primitives and `StyleSheet.create`.
- Use `ThemedText`, `ThemedView`, and `Colors` where practical so light and dark modes continue to work.
- Keep controls accessible with `accessibilityRole`, clear labels, and adequate hit targets.
- Prefer compact, task-focused UI over marketing-style layouts; this app is a daily utility.
- Avoid adding new UI frameworks unless the task clearly needs one.

## Navigation

- Use Expo Router APIs (`router`, `useLocalSearchParams`) for navigation and route params.
- Keep the main day view on `app/(tabs)/index.tsx`.
- Keep entry creation and editing on `app/(tabs)/entry.tsx` unless a larger route change is explicitly requested.

## Testing And Verification

- There is currently no dedicated test runner configured.
- For logic-heavy changes, add focused pure helpers where they can be tested later.
- Verify user-visible flows manually with Expo when behavior changes:
  - add an entry
  - edit an entry
  - delete an entry
  - confirm today's calorie total and "since food" timer
  - reload and confirm entries persist

## Keeping This Guide Current

- Update this guide when a change affects how agents should work in this repo, including commands, routes, state ownership, persistence, dependencies, testing, verification, or project conventions.
- Keep this guide focused on current workflow and conventions rather than historical notes or ordinary feature changes.
- Do not update this guide for routine edits that do not change how future agents should navigate, modify, run, or verify the project.

## Git And Workspace Hygiene

- The worktree may contain user changes. Do not revert or overwrite unrelated edits.
- Keep generated files and dependency churn out of changes unless the task requires them.
- If dependencies change, update both `package.json` and `package-lock.json`.
