# Mobile App (Android / iOS) — React Native + Expo

Shares business logic and the API client with web/desktop via `packages/shared`; talks to the same `apps/api` backend used by the web and desktop apps.

## Prerequisites (local dev machine)

- Node.js 18/20/22 (already required for the rest of the monorepo)
- [Expo Go](https://expo.dev/go) app on your phone (fastest way to test), or Android Studio / Xcode if you want a simulator
- A free [Expo](https://expo.dev) account for EAS builds (only needed when producing installable `.apk`/`.ipa` files — not for day-to-day development)

## Develop

```bash
cd apps/mobile
cp .env.example .env   # point at your local API + Supabase
npm install
npm run start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS) to run it on a physical device. When testing on a physical device, set `EXPO_PUBLIC_API_URL` in `.env` to your computer's LAN IP (not `localhost`) so the phone can reach the API server running on your machine.

## Build installable binaries

Production builds use [EAS Build](https://docs.expo.dev/build/introduction/) (free tier available), which builds in the cloud so you don't need Xcode/Android Studio installed:

```bash
npm install -g eas-cli
eas login
eas build:configure
npm run build:android   # produces an .apk / .aab
npm run build:ios       # produces an .ipa (requires an Apple Developer account to distribute)
```

Set the same `EXPO_PUBLIC_*` variables for production in `eas.json` (per-profile `env`) or via `eas secret:create`, pointing at your **production** Supabase project and Hostnin-hosted API — never bake local/dev values into a release build.

## Structure

- `src/lib` — Supabase client (session persisted in the OS keychain via `expo-secure-store`) and the shared `ApiClient`.
- `src/contexts/AuthContext.tsx` — mirrors the web app's auth context: session, profile, license/trial status.
- `src/navigation` — bottom tabs (Calendar, Tasks, **+**, Notifications, Profile) per the spec; the **+** tab is intercepted to open a modal action sheet (New Event / New Meeting / New Task / Reminder) instead of navigating to a real tab.
- `src/screens` — one screen per tab, plus the create-menu and create-form modals.

## Scope note

This reference implementation ships fully wired Calendar (agenda list), Tasks, Notifications, Profile, and quick-create screens. The web app remains the richer surface for advanced calendar editing (drag/drop, recurrence, participant management) — the mobile create form intentionally keeps data entry simple (title, date/time as text, notes) to avoid pulling in a native date-picker dependency for this reference build. Swap in `@react-native-community/datetimepicker` for a native picker before shipping to production.
