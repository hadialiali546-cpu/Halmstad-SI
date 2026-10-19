// Two-way sync between the in-memory DB object (used by every screen) and Firestore.
// Each array in DB is a Firestore collection (one document per item); small settings
// live in a single meta/app document. Writes are diffs: only changed documents are sent.
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, writeBatch, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import type { DB } from '@/data/types';

type KeyFn = (x: Record<string, unknown>) => string;
const byId: KeyFn = (x) => String(x.id);

/** Where each DB field is stored. Typed against DB so nothing can be forgotten. */
const STORAGE: Record<keyof DB, { col: string; key: KeyFn } | 'meta' | 'local'> = {
  version: 'meta', seededAt: 'meta', exportConfigs: 'meta', settings: 'meta', evaluationTemplate: 'meta',
  eduCategories: 'meta', timeSlots: 'meta', semesterArchive: 'meta',
  readNotificationIds: 'local', // read/unread state is per person and per device
  users: { col: 'users', key: byId },
  courses: { col: 'courses', key: byId },
  courseAssignments: { col: 'courseAssignments', key: byId },
  coachAssignments: { col: 'coachAssignments', key: (x) => String(x.leaderId) },
  enrollments: { col: 'enrollments', key: (x) => `${x.studentId}_${x.courseId}` },
  sessions: { col: 'sessions', key: byId },
  attendance: { col: 'attendance', key: byId },
  topics: { col: 'topics', key: byId },
  timePrefs: { col: 'timePrefs', key: (x) => `${x.studentId}_${x.courseId}` },
  observations: { col: 'observations', key: byId },
  eduActivities: { col: 'eduActivities', key: byId },
  surveys: { col: 'surveys', key: byId },
  workActivities: { col: 'workActivities', key: byId },
  reports: { col: 'reports', key: byId },
  notifications: { col: 'notifications', key: byId },
  calendarConnections: { col: 'calendarConnections', key: (x) => String(x.userId) },
  feedback: { col: 'feedback', key: byId },
  substituteRequests: { col: 'substituteRequests', key: byId },
  grades: { col: 'grades', key: byId },
  evaluations: { col: 'evaluations', key: byId },
};
const FIELDS = Object.entries(STORAGE) as [keyof DB, (typeof STORAGE)[keyof DB]][];
const COLS = FIELDS.filter(([, v]) => typeof v === 'object') as [keyof DB, { col: string; key: KeyFn }][];
const META_KEYS = FIELDS.filter(([, v]) => v === 'meta').map(([k]) => k);
export const DATA_COLLECTIONS = COLS.map(([, v]) => v.col);

const SEQ = '_seq';
let seqCounter = 0;
const nextSeq = () => Date.now() * 1000 + (seqCounter++ % 1000);
const strip = (o: unknown) => JSON.stringify(o, (k, v) => (k === SEQ ? undefined : v));

type Row = Record<string, unknown>;
export interface Op { kind: 'set' | 'del'; col: string; id: string; data?: Row }

/** Pure diff: which Firestore documents must be written/deleted to go from prev to next */
export function diffOps(prev: DB, next: DB): Op[] {
  const ops: Op[] = [];
  for (const [field, { col, key }] of COLS) {
    const a = new Map((prev[field] as unknown as Row[]).map((x) => [key(x), x]));
    const b = new Map((next[field] as unknown as Row[]).map((x) => [key(x), x]));
    b.forEach((x, id) => {
      const old = a.get(id);
      if (!old || strip(old) !== strip(x)) ops.push({ kind: 'set', col, id, data: { ...x, [SEQ]: x[SEQ] ?? old?.[SEQ] ?? nextSeq() } });
    });
    a.forEach((_, id) => { if (!b.has(id)) ops.push({ kind: 'del', col, id }); });
  }
  if (META_KEYS.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k])))
    ops.push({ kind: 'set', col: 'meta', id: 'app', data: Object.fromEntries(META_KEYS.map((k) => [k, next[k]])) });
  return ops;
}

export class CloudSync {
  private maps = new Map<string, Map<string, Row>>();
  private loaded = new Set<string>();
  private meta: Row | null | undefined = undefined; // undefined = not yet loaded, null = missing
  private unsubs: Unsubscribe[] = [];
  private scheduled = false;

  constructor(private fs: Firestore) {}

  /** onData(null) = database is empty (not seeded yet) */
  subscribe(onData: (db: Omit<DB, 'readNotificationIds'> | null) => void, onError: (e: Error) => void) {
    const emit = () => {
      if (this.scheduled) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        if (this.meta === undefined) return;
        if (this.meta === null) return onData(null);
        if (this.loaded.size < COLS.length) return;
        onData(this.assemble());
      });
    };
    this.unsubs.push(onSnapshot(doc(this.fs, 'meta', 'app'), (s) => { this.meta = s.exists() ? (s.data() as Row) : null; emit(); }, onError));
    for (const [, { col }] of COLS) {
      this.unsubs.push(onSnapshot(collection(this.fs, col), (snap) => {
        const m = new Map<string, Row>();
        snap.forEach((d) => m.set(d.id, d.data() as Row));
        this.maps.set(col, m);
        this.loaded.add(col);
        emit();
      }, onError));
    }
    return () => this.unsubs.splice(0).forEach((u) => u());
  }

  private assemble(): Omit<DB, 'readNotificationIds'> {
    const out: Row = {};
    for (const k of META_KEYS) out[k] = this.meta![k];
    for (const [field, { col }] of COLS) {
      const arr = [...(this.maps.get(col)?.values() ?? [])].sort((a, b) => Number(a[SEQ] ?? 0) - Number(b[SEQ] ?? 0));
      out[field] = arr;
    }
    const by = (k: string, desc = false) => (a: Row, b: Row) => (desc ? -1 : 1) * String(a[k] ?? '').localeCompare(String(b[k] ?? ''));
    (out.sessions as Row[]).sort(by('start'));
    (out.notifications as Row[]).sort(by('createdAt', true));
    (out.topics as Row[]).sort(by('createdAt', true));
    (out.surveys as Row[]).sort(by('createdAt', true));
    return out as unknown as Omit<DB, 'readNotificationIds'>;
  }

  /** Write the difference between two DB states */
  async write(prev: DB, next: DB) {
    await this.commit(diffOps(prev, next));
  }

  private async commit(ops: Op[]) {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(this.fs);
      ops.slice(i, i + 400).forEach((o) => {
        const ref = doc(this.fs, o.col, o.id);
        if (o.kind === 'set') batch.set(ref, JSON.parse(JSON.stringify(o.data))); else batch.delete(ref);
      });
      await batch.commit();
    }
  }

  /** Replace everything with the given dataset (supervisor only) */
  async replaceAll(db: DB) {
    await this.wipe();
    const ops: Op[] = [];
    for (const [field, { col, key }] of COLS) {
      (db[field] as unknown as Row[]).forEach((x, i) => ops.push({ kind: 'set', col, id: key(x), data: { ...x, [SEQ]: i } }));
    }
    // meta last, so other devices only see a complete dataset
    await this.commit(ops);
    await this.commit([{ kind: 'set' as const, col: 'meta', id: 'app', data: Object.fromEntries(META_KEYS.map((k) => [k, db[k]])) }]);
  }

  async wipe() {
    await deleteDoc(doc(this.fs, 'meta', 'app')).catch(() => undefined);
    for (const [, { col }] of COLS) {
      const snap = await getDocs(collection(this.fs, col));
      const ops = snap.docs.map((d) => ({ kind: 'del' as const, col, id: d.id }));
      await this.commit(ops);
    }
  }
}
