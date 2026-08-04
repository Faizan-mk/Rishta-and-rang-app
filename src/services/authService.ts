import { storage } from './storage';
import { mockHash } from './hash';
import type { StoredCredential, UserProfile, AppLanguage, Intent } from '../types/user';

async function getUsers(): Promise<Record<string, UserProfile>> {
  return storage.getJSON(storage.KEYS.users, {} as Record<string, UserProfile>);
}

async function getCredentials(): Promise<Record<string, StoredCredential>> {
  return storage.getJSON(storage.KEYS.credentials, {} as Record<string, StoredCredential>);
}

function newId(): string {
  return `u_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
  dob: string;
  gender: UserProfile['gender'];
  city: string;
  intent: Intent;
  language: AppLanguage;
  bio?: string;
  photos?: string[];
  selfieVerified?: boolean;
}

async function emailExists(email: string): Promise<boolean> {
  const credentials = await getCredentials();
  return Boolean(credentials[email.trim().toLowerCase()]);
}

async function signup(input: SignupInput): Promise<UserProfile> {
  const email = input.email.trim().toLowerCase();
  const credentials = await getCredentials();
  if (credentials[email]) {
    throw new Error('An account with this email already exists.');
  }

  const id = newId();
  const user: UserProfile = {
    id,
    fullName: input.fullName.trim(),
    email,
    dob: input.dob,
    gender: input.gender,
    city: input.city.trim(),
    bio: input.bio?.trim() ?? '',
    photos: input.photos ?? [],
    selfieVerified: input.selfieVerified ?? false,
    intent: input.intent,
    language: input.language,
    activeMode: input.intent === 'matrimonial' ? 'rishta' : 'dating',
    dating: { vibeTags: [] },
    rishta: {
      religion: '',
      sect: '',
      familyBackground: '',
      education: '',
      readiness: 'browsing',
    },
    createdAt: new Date().toISOString(),
  };

  const users = await getUsers();
  users[id] = user;
  await storage.setJSON(storage.KEYS.users, users);

  credentials[email] = { email, passwordHash: mockHash(input.password), userId: id };
  await storage.setJSON(storage.KEYS.credentials, credentials);

  await storage.setJSON(storage.KEYS.session, { userId: id });
  return user;
}

async function login(email: string, password: string): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const credentials = await getCredentials();
  const credential = credentials[normalizedEmail];
  if (!credential || credential.passwordHash !== mockHash(password)) {
    throw new Error('Incorrect email or password.');
  }

  const users = await getUsers();
  const user = users[credential.userId];
  if (!user) {
    throw new Error('Account data could not be found.');
  }

  await storage.setJSON(storage.KEYS.session, { userId: user.id });
  return user;
}

async function logout(): Promise<void> {
  await storage.setJSON(storage.KEYS.session, null);
}

async function getCurrentUser(): Promise<UserProfile | null> {
  const session = await storage.getJSON<{ userId: string } | null>(storage.KEYS.session, null);
  if (!session) return null;
  const users = await getUsers();
  return users[session.userId] ?? null;
}

async function updateUser(updated: UserProfile): Promise<UserProfile> {
  const users = await getUsers();
  users[updated.id] = updated;
  await storage.setJSON(storage.KEYS.users, users);
  return updated;
}

export const authService = { signup, login, logout, getCurrentUser, updateUser, emailExists };
