// Feature requests & feedback from any user, reviewed by SI supervisors.
// Local mode: kept in this browser. Cloud mode: Firestore collection `featureRequests`
// (anyone signed in may create; only supervisors can read or update — see firestore.rules).
// Kept outside the shared DB on purpose, so non-supervisors never download other people's requests.
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { useIdentity } from '@/backend/identity';

export type RequestKind = 'feature' | 'improvement' | 'problem' | 'feedback';
export type RequestPriority = 'nice' | 'important' | 'blocking';
export type RequestStatus = 'new' | 'planned' | 'in_progress' | 'shipped' | 'declined';

export interface FeatureRequest {
  id: string;
  ref: string; // short human reference, e.g. FR-4K2P
  kind: RequestKind;
  title: string;
  details: string;
  area: string; // page/section label chosen by the user
  path: string; // page the user was on
  role: string;
  priority: RequestPriority;
  email: string;
  name: string;
  uid?: string;
  status: RequestStatus;
  createdAt: string;
}

export const KIND_LABEL: Record<RequestKind, string> = {
  feature: 'New feature', improvement: 'Improvement', problem: 'Something is broken', feedback: 'General feedback',
};
export const PRIORITY_LABEL: Record<RequestPriority, string> = {
  nice: 'Nice to have', important: 'Important', blocking: 'Blocking my work',
};
export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'New', planned: 'Planned', in_progress: 'In progress', shipped: 'Shipped', declined: 'Not planned',
};

const LOCAL_KEY = 'halmstad-si-feature-requests';
const COL = 'featureRequests';

const newRef = () => 'FR-' + Math.random().toString(36).slice(2, 6).toUpperCase();

function sample(): FeatureRequest[] {
  const d = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
  return [
    {
      id: 'fr-sample-1', ref: 'FR-7Q2M', kind: 'feature', status: 'planned', priority: 'important', role: 'leader',
      title: 'Copy last week’s session plan to a new session',
      details: 'When I plan a session I usually start from last week’s plan. A “Duplicate plan” button on the session card would save me about 10 minutes per session.',
      area: 'SI Leader · My Sessions', path: '/leader/sessions', email: 'alex.nilsson@example.org', name: 'Alex Nilsson (demo)', createdAt: d(3),
    },
    {
      id: 'fr-sample-2', ref: 'FR-K8D1', kind: 'improvement', status: 'new', priority: 'nice', role: 'student',
      title: 'Show the room on the session reminder',
      details: 'The reminder only says the time. If it showed the room and building I would not need to open the app to find where to go.',
      area: 'Student · Notifications', path: '/student/notifications', email: 'emma.andersson@example.org', name: 'Emma Andersson (demo)', createdAt: d(1),
    },
  ];
}

function readLocal(): FeatureRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as FeatureRequest[];
  } catch { /* storage unavailable */ }
  return sample();
}
function writeLocal(list: FeatureRequest[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  window.dispatchEvent(new Event('feature-requests-changed'));
}

export type NewRequest = Omit<FeatureRequest, 'id' | 'ref' | 'status' | 'createdAt' | 'uid'>;

/** Submit a request. Returns the short reference shown to the user. */
export function useSubmitRequest() {
  const { backend, user } = useIdentity();
  return async (r: NewRequest): Promise<string> => {
    const ref = newRef();
    const rec: FeatureRequest = { ...r, id: `fr-${Date.now().toString(36)}-${ref.slice(3).toLowerCase()}`, ref, status: 'new', createdAt: new Date().toISOString() };
    if (backend?.mode === 'cloud') {
      await setDoc(doc(backend.fs, COL, rec.id), { ...rec, uid: user?.uid ?? '' });
    } else {
      writeLocal([rec, ...readLocal()]);
    }
    return ref;
  };
}

/** Supervisor inbox: live list + status updates */
export function useFeatureRequests() {
  const { backend } = useIdentity();
  const cloud = backend?.mode === 'cloud' ? backend : null;
  const [list, setList] = useState<FeatureRequest[]>(() => (cloud ? [] : readLocal()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cloud) {
      return onSnapshot(query(collection(cloud.fs, COL), orderBy('createdAt', 'desc')),
        (s) => { setList(s.docs.map((x) => x.data() as FeatureRequest)); setError(null); },
        () => setError('Could not load requests. Only SI supervisors can read them.'));
    }
    const refresh = () => setList(readLocal());
    window.addEventListener('feature-requests-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('feature-requests-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [cloud]);

  const setStatus = async (id: string, status: RequestStatus) => {
    if (cloud) { await updateDoc(doc(cloud.fs, COL, id), { status }); return; }
    writeLocal(readLocal().map((r) => (r.id === id ? { ...r, status } : r)));
  };
  return { list: [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), setStatus, error };
}
