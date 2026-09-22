# Rishta & Rang

A South Asian matchmaking app built with Expo (React Native) and Supabase, supporting English, Roman Urdu, and Urdu.

## Tech stack

- **App**: [Expo](https://docs.expo.dev/versions/v57.0.0/) SDK 54, React Native 0.81, React 19, TypeScript
- **Routing**: expo-router (typed routes)
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **Payments/Entitlements**: RevenueCat (`react-native-purchases`)
- **Testing**: Jest + `jest-expo` + React Native Testing Library
- **i18n**: English, Roman Urdu, Urdu (`src/i18n`)

> **Note:** Expo has changed significantly across versions. Always check the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo-related code, rather than relying on general/older Expo knowledge.

## Project structure

```
src/
  app/            # expo-router routes (screens are wired here)
    (auth)/        # login, signup, forgot/reset password, verification
    (tabs)/        # home, explore, messages, profile tab screens
    chat/          # chat thread screen
  screens/        # screen implementations by feature area
  components/     # shared + feature UI components (dashboard, discover, matches, profile, rishta)
  services/       # Supabase-backed services (auth, matches, likes, chat, billing, notifications, etc.)
  store/          # app state
  hooks/          # shared hooks
  i18n/           # translations (en, roman, ur) + vocabulary
  theme/          # theming
  config/         # feature flags (src/config/features.ts)
  types/, utils/, constants/, data/

supabase/         # SQL migrations (numbered), Edge Functions, and verification/test scripts
docs/             # delivery plan, handover notes, smoke test checklist, legal source docs
scripts/          # build scripts (e.g. legal pages)
```

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with the required variables (see [Environment variables](#environment-variables)).
3. Start the dev server:
   ```bash
   npm start        # expo start
   npm run android  # expo start --android
   npm run ios      # expo start --ios
   npm run web      # expo start --web
   ```

## Environment variables

Set these in `.env` (all consumed via `EXPO_PUBLIC_*` so they are available client-side):

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public API key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat API key (Android) |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | Privacy policy URL used in-app |
| `EXPO_PUBLIC_TERMS_URL` | Terms of service URL used in-app |

## Backend (Supabase)

Database schema, RLS policies, and functions live in [supabase/](supabase/) as sequentially numbered SQL migrations (`1_extension.sql`, `2_profiles.sql`, ... `44_notification_related_profile.sql`), applied in order. Edge Functions live in `supabase/functions/` (`revenuecat-webhook`, `send-push`, `sync-entitlement`). Manual verification scripts for core flows (matching, messaging, blocking, entitlements, notifications) are in `supabase/tests/`.

## Testing

```bash
npm test         # run Jest once
npm run test:watch
```

Tests live alongside source in `__tests__` folders under `src/` (Jest config: [jest.config.js](jest.config.js)).

## Building & deployment

- Builds are managed with **EAS** (`eas.json`): `development`, `preview` (Android APK), and `production` profiles.
- Legal pages (privacy/terms) are generated via `npm run legal:build` (see `scripts/build-legal-pages.mjs` and `docs/legal/`).
- `vercel.json` is present for web-related deployment.

## Feature flags

Feature flags are defined in [src/config/features.ts](src/config/features.ts) (e.g. `FEATURE_BUREAU`, gating the background-check badge/UI until real verification is implemented — see [docs/handover-notes.md](docs/handover-notes.md)).

## Docs

- [docs/handover-notes.md](docs/handover-notes.md) — known gaps/caveats (e.g. identity verification is currently submission-only, not verified)
- [docs/smoke-test.md](docs/smoke-test.md) — manual smoke test checklist
- [docs/Rishta-and-Rang-V1-Delivery-Plan.pdf](docs/Rishta-and-Rang-V1-Delivery-Plan.pdf) / `V1-Delivery-Plan.html` — delivery plan

## License

See [LICENSE](LICENSE).
