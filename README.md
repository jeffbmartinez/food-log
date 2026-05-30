# Food Log

An Expo React Native app for logging daily food and drink intake. It tracks entries for the current day, totals known calories, and shows how long it has been since the latest calorie-containing item.

## Get Started

Install dependencies:

```bash
npm install
```

Start the native development server:

```bash
npm start
```

Start the web app directly:

```bash
npm run web
```

## Development

The app uses Expo Router. The main day view is in `app/(tabs)/index.tsx`, entry creation and editing live in `app/(tabs)/entry.tsx`, and food-log persistence/state is centralized in `lib/food-log-store.tsx`.

Useful checks:

```bash
npm run lint
npm run knip
npm run klint # runs lint followed by knip
```
