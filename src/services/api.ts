// Barrel for the Supabase-backed services. Screens and stores can import the
// one they need from here instead of reaching for each module by name.
export { authService } from './authService';
export type { SignupInput, ProfileDoc } from './authService';
export { boostService } from './boostService';
export { discoveryService } from './discoveryService';
export { favoritesService } from './favoritesService';
export { likeLimitService } from './likeLimitService';
export { likesService } from './likesService';
export type { LikeReceived } from './likesService';
export { matchesService } from './matchesService';
export { mediaUpload } from './mediaUpload';
export { notificationsService } from './notificationsService';
export { privacyService } from './privacyService';
export { viewHistoryService } from './viewHistoryService';
export { cache, CACHE_KEYS } from './cache';
export { storage } from './storage';
export { supabase, publicMediaUrl, PUBLIC_BUCKET, VERIFICATION_BUCKET } from './supabase';
