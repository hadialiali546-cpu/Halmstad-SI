// Who is using the app. Local mode: demo personas + free role switching.
// Cloud mode: Firebase Authentication + a profile document (profiles/{uid}) that holds
// the person's role and the user record they are linked to. Roles are assigned by an
// SI supervisor; the first supervisor is bootstrapped from config/roles (set by the
// deploy script with the project owner's email).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut as fbSignOut, updateProfile, type User as FbUser,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Role } from '@/data/types';
import { PERSONAS } from '@/data/seed';
import { initBackend, type BackendMode } from './firebase';

export interface Profile {
  uid: string;
  email: string;
  name: string;
  role: Role | 'pending';
  /** id of the person record in the users collection */
  userId?: string;
  /** demo/test accounts may switch between all four role views */
  allRoles: boolean;
}

interface IdentityValue {
  backend: BackendMode | null;
  user: FbUser | null;
  profile: Profile | null;
  /** cloud mode: auth + profile resolved */
  ready: boolean;
  bootstrapNeedsVerification: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  /** person record used for a role view */
  personaFor: (role: Role) => string;
  canSwitchRoles: boolean;
}

const Ctx = createContext<IdentityValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<BackendMode | null>(null);
  const [user, setUser] = useState<FbUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  useEffect(() => { initBackend().then(setBackend); }, []);

  useEffect(() => {
    if (!backend) return;
    if (backend.mode === 'local') { setReady(true); return; }
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(backend.auth, (u) => {
      unsubProfile?.(); unsubProfile = null;
      setUser(u); setProfile(null); setNeedsVerify(false);
      if (!u) { setReady(true); return; }
      setReady(false);
      const ref = doc(backend.fs, 'profiles', u.uid);
      unsubProfile = onSnapshot(ref, async (snap) => {
        if (snap.exists()) { setProfile({ uid: u.uid, ...(snap.data() as Omit<Profile, 'uid'>) }); setReady(true); return; }
        // First sign-in: create the profile. Project owner(s) listed in config/roles become supervisor.
        const email = (u.email ?? '').toLowerCase();
        let isBootstrap = false;
        try {
          const cfg = await getDoc(doc(backend.fs, 'config', 'roles'));
          isBootstrap = ((cfg.data()?.supervisors as string[] | undefined) ?? []).map((e) => e.toLowerCase()).includes(email);
        } catch { /* ignore */ }
        const base = { email, name: u.displayName || email.split('@')[0], createdAt: serverTimestamp() };
        if (isBootstrap && !u.emailVerified) { setNeedsVerify(true); setReady(true); return; }
        try {
          await setDoc(ref, isBootstrap
            ? { ...base, role: 'supervisor', userId: PERSONAS.supervisor, allRoles: true }
            : { ...base, role: 'pending', allRoles: false });
        } catch (e) {
          console.error('Could not create profile', e);
          setReady(true);
        }
      }, () => setReady(true));
    });
    return () => { unsubAuth(); unsubProfile?.(); };
  }, [backend]);

  const auth = backend?.mode === 'cloud' ? backend.auth : null;
  const value: IdentityValue = {
    backend, user, profile, ready: !!backend && ready, bootstrapNeedsVerification: needsVerify,
    signIn: async (email, password) => { await signInWithEmailAndPassword(auth!, email.trim(), password); },
    signUp: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(auth!, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user).catch(() => undefined);
    },
    resetPassword: async (email) => { await sendPasswordResetEmail(auth!, email.trim()); },
    resendVerification: async () => { if (auth?.currentUser) await sendEmailVerification(auth.currentUser); },
    signOut: async () => { if (auth) await fbSignOut(auth); },
    personaFor: (role) => {
      if (backend?.mode === 'cloud' && profile && !profile.allRoles && profile.userId) return profile.userId;
      if (backend?.mode === 'cloud' && profile?.userId && profile.role === role) return profile.userId;
      return PERSONAS[role];
    },
    canSwitchRoles: backend?.mode !== 'cloud' || !!profile?.allRoles,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIdentity() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useIdentity outside provider');
  return v;
}

export const authErrorText = (code: string) => ({
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email.',
  'auth/email-already-in-use': 'An account with this email already exists — sign in instead.',
  'auth/weak-password': 'Use at least 8 characters.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled yet. Enable Email/Password in Firebase Console → Authentication.',
  'auth/network-request-failed': 'Network error — check your connection.',
} as Record<string, string>)[code] ?? 'Something went wrong. Please try again.';
