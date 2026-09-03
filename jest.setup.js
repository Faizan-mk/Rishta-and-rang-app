// `src/services/supabase.ts` throws at import time when the EXPO_PUBLIC_* keys
// are missing — a deliberate fail-fast for the app, and a module any service
// test pulls in transitively. Real values are never needed here: nothing under
// test makes a request, and `createClient` does not connect when it is built.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// AsyncStorage is a native module, so it is null under Jest and throws the
// moment `services/supabase.ts` imports it — which every service test pulls in
// transitively. The package ships a mock for exactly this.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
