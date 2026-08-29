import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

// Entry point and anchor route: forwards the visitor into the tabs when signed
// in, and to the welcome screen when not.
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/home' : '/welcome'} />;
}
