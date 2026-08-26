#!/usr/bin/env node
// ---------------------------------------------------------------------------
// One-off migration: Supabase (Postgres + Storage + Auth) → Firebase
// (Firestore + Cloud Storage + Firebase Auth).
//
//   node scripts/migrate-supabase-to-firebase.mjs --dry-run   # report only
//   node scripts/migrate-supabase-to-firebase.mjs             # write
//   node scripts/migrate-supabase-to-firebase.mjs --default-password=Temp123!
//
// Needs, in .env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (Supabase → Settings → API)
//   FIREBASE_SERVICE_ACCOUNT                  (path to the service-account JSON)
//
// Safe to re-run: every write is keyed by the original Supabase id, so a second
// pass overwrites rather than duplicating. Auth users already present are left
// alone.
//
// Passwords: Supabase's own hashes aren't exposed by its admin API. Where this
// app kept a bcrypt hash in `profiles.password_hash` it's imported directly and
// the member's existing password keeps working. Rows without one can't carry a
// password over — pass --default-password=... to give those accounts a shared
// temporary password, or leave it off and send each of them a reset email. The
// script lists every affected address at the end either way.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_PASSWORD = process.argv.find((arg) => arg.startsWith('--default-password='))?.split('=').slice(1).join('=');

if (DEFAULT_PASSWORD !== undefined && DEFAULT_PASSWORD.length < 6) {
  console.error('--default-password must be at least 6 characters (Firebase minimum).');
  process.exit(1);
}

const PUBLIC_BUCKET = 'public-media';
const VERIFICATION_BUCKET = 'private-verification';

// -- setup ------------------------------------------------------------------

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
  return value;
}

const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const serviceAccountPath = resolve(process.cwd(), required('FIREBASE_SERVICE_ACCOUNT'));
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const stats = { users: 0, profiles: 0, files: 0, docs: 0, skipped: [], errors: [] };

// -- helpers ----------------------------------------------------------------

/** Reads a whole table, paging past PostgREST's 1000-row default. */
async function readTable(table, columns = '*') {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) {
      if (/does not exist|schema cache|not find the table/i.test(error.message)) {
        console.log(`  · ${table}: table not present, skipping`);
        return [];
      }
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  console.log(`  · ${table}: ${rows.length} rows`);
  return rows;
}

async function write(ref, data) {
  stats.docs += 1;
  if (DRY_RUN) return;
  await ref.set(data, { merge: true });
}

/**
 * Copies one object from a Supabase bucket into Cloud Storage and returns a
 * stable download URL. Stamping firebaseStorageDownloadTokens ourselves makes
 * the URL identical in shape to what getDownloadURL() hands the client, so the
 * app can't tell migrated media apart from media it uploaded itself.
 */
const urlCache = new Map();

async function copyFile(sourceBucket, sourcePath, destPath) {
  const cacheKey = `${sourceBucket}/${sourcePath}`;
  if (urlCache.has(cacheKey)) return urlCache.get(cacheKey);

  const { data, error } = await supabase.storage.from(sourceBucket).download(sourcePath);
  if (error || !data) {
    stats.errors.push(`download ${cacheKey}: ${error?.message ?? 'empty'}`);
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const token = randomUUID();
  const contentType = data.type || 'application/octet-stream';

  if (!DRY_RUN) {
    await bucket.file(destPath).save(buffer, {
      contentType,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
  }

  stats.files += 1;
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    destPath
  )}?alt=media&token=${token}`;
  urlCache.set(cacheKey, url);
  return url;
}

/** public-media path `uid/photos/x.jpg` → `public/uid/photos/x.jpg`. */
async function copyPublic(sourcePath) {
  if (!sourcePath) return null;
  if (/^https?:\/\//i.test(sourcePath)) return sourcePath; // already a URL
  return copyFile(PUBLIC_BUCKET, sourcePath, `public/${sourcePath}`);
}

/** Verification media keeps a path (not a URL) — the app resolves it on read. */
async function copyVerification(sourcePath) {
  if (!sourcePath) return null;
  const destPath = `verification/${sourcePath}`;
  const url = await copyFile(VERIFICATION_BUCKET, sourcePath, destPath);
  return url ? destPath : null;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row[key]) ?? [];
    list.push(row);
    map.set(row[key], list);
  }
  return map;
}

// -- auth -------------------------------------------------------------------

async function listSupabaseAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.listUsers: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  console.log(`  · auth users: ${users.length}`);
  return users;
}

async function migrateAuthUsers(authUsers, profilesById) {
  const toImport = [];

  for (const user of authUsers) {
    let exists = false;
    try {
      await admin.auth().getUser(user.id);
      exists = true;
    } catch {
      exists = false;
    }
    if (exists) {
      console.log(`  · ${user.email}: already in Firebase Auth, leaving as-is`);
      continue;
    }

    const profile = profilesById.get(user.id);
    const record = {
      uid: user.id,
      email: user.email,
      emailVerified: Boolean(user.email_confirmed_at),
      displayName: profile?.full_name ?? undefined,
      disabled: false,
    };

    const hash = profile?.password_hash;
    if (hash && hash.startsWith('$2')) {
      record.passwordHash = Buffer.from(hash, 'utf8');
    } else {
      // No hash to carry over. importUsers can't set a plaintext password, so
      // these are created empty and given the temporary one afterwards.
      stats.skipped.push(user.email ?? user.id);
    }
    toImport.push(record);
  }

  if (!toImport.length) return;
  stats.users = toImport.length;
  if (DRY_RUN) return;

  // importUsers caps at 1000 per call, and a single hash config applies to the
  // whole call — so password-less records go in their own batch.
  const withHash = toImport.filter((u) => u.passwordHash);
  const withoutHash = toImport.filter((u) => !u.passwordHash);

  for (let i = 0; i < withHash.length; i += 1000) {
    const result = await admin
      .auth()
      .importUsers(withHash.slice(i, i + 1000), { hash: { algorithm: 'BCRYPT' } });
    result.errors.forEach((e) => stats.errors.push(`importUsers: ${e.error.message}`));
  }
  for (let i = 0; i < withoutHash.length; i += 1000) {
    const result = await admin.auth().importUsers(withoutHash.slice(i, i + 1000));
    result.errors.forEach((e) => stats.errors.push(`importUsers: ${e.error.message}`));
  }

  if (DEFAULT_PASSWORD) {
    for (const record of withoutHash) {
      try {
        await admin.auth().updateUser(record.uid, { password: DEFAULT_PASSWORD });
      } catch (err) {
        stats.errors.push(`set temp password ${record.email}: ${err.message}`);
      }
    }
  }
}

// -- profiles ---------------------------------------------------------------

async function migrateProfile(row, photoRows, verificationRow) {
  const photos = [];
  for (const photo of [...photoRows].sort((a, b) => a.position - b.position)) {
    const url = await copyPublic(photo.storage_path);
    if (url) photos.push(url);
  }

  const profileDoc = {
    fullName: row.full_name,
    dob: row.dob,
    gender: row.gender,
    city: row.city ?? '',
    bio: row.bio ?? '',
    intent: row.intent,
    language: row.language,
    activeMode: row.active_mode,
    datingVibeTags: row.dating_vibe_tags ?? [],
    datingIntentionLabel: row.dating_intention_label ?? null,
    rishtaReligion: row.rishta_religion ?? '',
    rishtaSect: row.rishta_sect ?? '',
    rishtaFamilyBackground: row.rishta_family_background ?? '',
    rishtaEducation: row.rishta_education ?? '',
    rishtaReadiness: row.rishta_readiness ?? 'browsing',
    rishtaPrayerHabits: row.rishta_prayer_habits ?? null,
    rishtaIncomeRange: row.rishta_income_range ?? null,
    rishtaLivingAbroad: row.rishta_living_abroad ?? null,
    heightCm: row.height_cm ?? null,
    maritalStatus: row.marital_status ?? null,
    hasChildren: row.has_children ?? null,
    occupation: row.occupation ?? null,
    practising: row.practising ?? null,
    prayerHabits: row.prayer_habits ?? null,
    halalOnly: row.halal_only ?? null,
    smoking: row.smoking ?? null,
    drinking: row.drinking ?? null,
    religiousDress: row.religious_dress ?? null,
    openToRelocate: row.open_to_relocate ?? null,
    preferredCountry: row.preferred_country ?? null,
    careerPlans: row.career_plans ?? null,
    educationLevel: row.education_level ?? null,
    degree: row.degree ?? null,
    jobTitle: row.job_title ?? null,
    industry: row.industry ?? null,
    languages: row.languages ?? null,
    nationality: row.nationality ?? null,
    grewUpIn: row.grew_up_in ?? null,
    country: row.country ?? null,
    selfieVerified: Boolean(row.selfie_verified),
    photos,
    voiceIntroUrl: await copyPublic(row.voice_intro_path),
    voiceIntroDurationSec: row.voice_intro_duration_sec ?? null,
    videoIntroUrl: await copyPublic(row.video_intro_path),
    waliName: row.wali_name ?? null,
    waliInvitedAt: row.wali_invited_at ?? null,
    isExplorePlus: Boolean(row.is_explore_plus),
    subscriptionPlan: row.subscription_plan ?? null,
    hasUsedTrial: Boolean(row.has_used_trial),
    subscriptionRenewsAt: row.subscription_renews_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };

  await write(db.collection('profiles').doc(row.id), profileDoc);
  await write(db.doc(`users/${row.id}/private/profile`), {
    email: row.email,
    waliContact: row.wali_contact ?? null,
  });

  if (verificationRow) {
    await write(db.doc(`users/${row.id}/private/verification`), {
      cnicNumber: verificationRow.cnic_number ?? null,
      cnicPhotoPath: await copyVerification(verificationRow.cnic_photo_path),
      cnicVerified: Boolean(verificationRow.cnic_verified),
      bureauVerified: Boolean(verificationRow.bureau_verified),
      selfiePhotoPath: await copyVerification(verificationRow.selfie_photo_path),
    });
  }

  stats.profiles += 1;
}

// -- per-user collections ---------------------------------------------------

async function migrateMatches(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/matches/${row.id}`), {
      name: row.name,
      photo: row.photo,
      lastMessage: row.last_message ?? '',
      lastMessageAt: row.last_message_at,
      unread: Boolean(row.unread),
      mode: row.mode,
      movedToRishta: Boolean(row.moved_to_rishta),
      rishtaRequestPending: Boolean(row.rishta_request_pending),
      sourceProfileId: row.source_profile_id ?? null,
    });
  }
}

async function migrateMessages(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/messages/${row.id}`), {
      matchId: row.match_id,
      fromMe: Boolean(row.from_me),
      text: row.text ?? '',
      kind: row.kind,
      audioUrl: await copyPublic(row.audio_path),
      durationSec: row.duration_sec ?? null,
      imageUrl: await copyPublic(row.image_path),
      sentAt: row.sent_at,
    });
  }
}

async function migrateBlocked(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/blocked/${row.blocked_id}`), {
      sourceProfileId: row.source_profile_id ?? null,
      name: row.name,
      photo: row.photo,
      blockedAt: row.blocked_at,
    });
  }
}

async function migrateFavorites(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/favorites/${row.target_id}`), {
      kind: row.kind,
      name: row.name,
      age: row.age,
      city: row.city,
      photo: row.photo,
      createdAt: row.created_at ?? new Date().toISOString(),
    });
  }
}

async function migrateViewHistory(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/viewHistory/${row.viewed_id}`), {
      kind: row.kind,
      name: row.name,
      age: row.age,
      city: row.city,
      photo: row.photo,
      viewedAt: row.viewed_at,
    });
  }
}

async function migrateNotifications(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/notifications/${row.id}`), {
      type: row.type,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
      read: Boolean(row.read),
    });
  }
}

async function migrateNotificationPrefs(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/private/notificationPrefs`), {
      newMatches: Boolean(row.new_matches),
      messages: Boolean(row.messages),
      likes: Boolean(row.likes),
      rishtaRequests: Boolean(row.rishta_requests),
      productUpdates: Boolean(row.product_updates),
    });
  }
}

async function migratePrivacyPrefs(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/private/privacyPrefs`), {
      profileVisible: Boolean(row.profile_visible),
      onlineStatusVisible: Boolean(row.online_status_visible),
      blurPhotos: Boolean(row.blur_photos),
    });
  }
}

async function migrateDailyLikes(rows) {
  for (const row of rows) {
    await write(db.doc(`users/${row.profile_id}/private/dailyLikes`), {
      date: row.date,
      count: row.count,
    });
  }
}

// -- main -------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? '\nDRY RUN — nothing will be written.\n' : '\nMigrating Supabase → Firebase.\n');

  console.log('Reading Supabase…');
  const authUsers = await listSupabaseAuthUsers();
  const profiles = await readTable('profiles');
  const photos = await readTable('profile_photos');
  const verifications = await readTable('profile_verification');
  const matches = await readTable('matches');
  const messages = await readTable('chat_messages');
  const blocked = await readTable('blocked_users');
  const favorites = await readTable('favorites');
  const viewHistory = await readTable('view_history');
  const notifications = await readTable('notifications');
  const notificationPrefs = await readTable('notification_prefs');
  const privacyPrefs = await readTable('privacy_prefs');
  const dailyLikes = await readTable('daily_likes');

  const profilesById = new Map(profiles.map((row) => [row.id, row]));
  const photosByProfile = groupBy(photos, 'profile_id');
  const verificationByProfile = new Map(verifications.map((row) => [row.profile_id, row]));

  console.log('\nImporting auth users…');
  await migrateAuthUsers(authUsers, profilesById);

  console.log('\nMigrating profiles and media…');
  for (const row of profiles) {
    try {
      await migrateProfile(row, photosByProfile.get(row.id) ?? [], verificationByProfile.get(row.id) ?? null);
      console.log(`  ✓ ${row.email}`);
    } catch (err) {
      stats.errors.push(`profile ${row.id}: ${err.message}`);
      console.log(`  ✗ ${row.email}: ${err.message}`);
    }
  }

  console.log('\nMigrating per-user collections…');
  await migrateMatches(matches);
  await migrateMessages(messages);
  await migrateBlocked(blocked);
  await migrateFavorites(favorites);
  await migrateViewHistory(viewHistory);
  await migrateNotifications(notifications);
  await migrateNotificationPrefs(notificationPrefs);
  await migratePrivacyPrefs(privacyPrefs);
  await migrateDailyLikes(dailyLikes);

  console.log('\n--- Summary ---');
  console.log(`Auth users imported: ${stats.users}`);
  console.log(`Profiles migrated:   ${stats.profiles}`);
  console.log(`Files copied:        ${stats.files}`);
  console.log(`Documents written:   ${stats.docs}`);

  if (stats.skipped.length) {
    console.log(
      DEFAULT_PASSWORD
        ? `\nNo stored password hash — these accounts were given the temporary password (${stats.skipped.length}):`
        : `\nNo stored password hash — these accounts need a password reset email (${stats.skipped.length}):`
    );
    stats.skipped.forEach((email) => console.log(`  - ${email}`));
  }
  if (stats.errors.length) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach((message) => console.log(`  - ${message}`));
    process.exitCode = 1;
  }
  if (DRY_RUN) console.log('\nDry run complete — re-run without --dry-run to write.');
}

main().catch((err) => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
