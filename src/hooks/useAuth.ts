"use client";

import {useEffect, useState, useCallback} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {firebaseAuth, isFirebaseConfigured} from '@/lib/firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  configured: boolean;
}

export function useAuth(): AuthState & {
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth(), u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured) throw new Error('Firebase 尚未設定');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth(), provider);
  }, []);

  const signOutUser = useCallback(async () => {
    if (!isFirebaseConfigured) return;
    await signOut(firebaseAuth());
  }, []);

  const getIdToken = useCallback(async () => {
    if (!isFirebaseConfigured) return null;
    const u = firebaseAuth().currentUser;
    if (!u) return null;
    return u.getIdToken();
  }, []);

  return {user, loading, configured: isFirebaseConfigured, signIn, signOutUser, getIdToken};
}
