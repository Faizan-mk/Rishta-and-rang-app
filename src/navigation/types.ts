import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingDraft } from '../types/user';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined; // Step 1: account + personal details
  IntentPhotos: { draft: OnboardingDraft }; // Step 2: intent + photos
  SelfieVerification: { draft: OnboardingDraft }; // Step 3
};

export type MainTabParamList = {
  Home: undefined;
  Matches: undefined;
  Profile: undefined;
};

export type ProfileDetailParams = { kind: 'dating'; id: string } | { kind: 'rishta'; id: string };

export type AppStackParamList = {
  MainTabs: undefined;
  Chat: { matchId: string };
  Call: { name: string; photo: string; video?: boolean };
  EditProfile: undefined;
  RishtaProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
  ProfileDetail: ProfileDetailParams;
  ExplorePlus: undefined;
  Favorites: undefined;
  PrivacySafety: undefined;
  BlockedUsers: undefined;
  HelpSupport: undefined;
  CnicVerification: undefined;
  WaliDashboard: undefined;
  Legal: undefined;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<AppStackParamList, T>;
