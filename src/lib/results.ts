// Attendance ↔ final-grade analysis for finished courses.
// Grades are self-reported by students (U/3/4/5). In production, official results from Ladok
// would replace self-reports. Correlation ≠ causation: students who choose SI may differ.
import { parseISO } from 'date-fns';
import { attendanceMap, leadersOfCourse, round1, studentsOfCourse, userName } from '@/data/calc';
import type { DB, Grade } from '@/data/types';

export const GRADE_VALUE: Record<Grade, number> = { U: 0, '3': 3, '4': 4, '5': 5 };
export const GROUPS = [
  { key: '0', label: 'No SI', min: 0, max: 0 },
  { key: '1-3', label: '1–3 sessions', min: 1, max: 3 },
  { key: '4-8', label: '4–8 sessions', min: 4, max: 8 },
  { key: '9+', label: '9+ sessions', min: 9, max: Infinity },
] as const;

export const courseFinished = (db: DB, courseId: string, now = new Date()) => {
  const c = db.courses.find((x) => x.id === courseId);
  return !!c?.endDate && parseISO(c.endDate) < now;
};
export const finishedCourses = (db: DB, now = new Date()) => db.courses.filter((c) => courseFinished(db, c.id, now));

export function sessionsAttended(db: DB, studentId: string, courseId: string) {
  const att = attendanceMap(db);
  return db.sessions.filter((s) => s.courseId === courseId && att.get(s.id)?.studentIds?.includes(studentId)).length;
}

export interface ResultRow { studentId: string; name: string; courseId: string; attended: number; grade: Grade | null; reportedAt?: string; group: string }

export function resultRows(db: DB, courseIds: string[]): ResultRow[] {
  const att = attendanceMap(db);
  return courseIds.flatMap((cid) => {
    const cs = db.sessions.filter((s) => s.courseId === cid);
    return studentsOfCourse(db, cid).map((sid) => {
      const attended = cs.filter((s) => att.get(s.id)?.studentIds?.includes(sid)).length;
      const g = db.grades.find((x) => x.courseId === cid && x.studentId === sid);
      const group = GROUPS.find((x) => attended >= x.min && attended <= x.max)!.key;
      return { studentId: sid, name: userName(db, sid), courseId: cid, attended, grade: g?.grade ?? null, reportedAt: g?.reportedAt, group };
    });
  });
}

/** Spearman rank correlation (handles ties with average ranks) */
export function spearman(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array(n);
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r as number[];
  };
  const rx = rank(xs), ry = rank(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : null;
}

export const strength = (r: number | null) =>
  r === null ? 'not enough data' : Math.abs(r) < 0.1 ? 'no clear relationship' : Math.abs(r) < 0.3 ? `weak ${r > 0 ? 'positive' : 'negative'}` : Math.abs(r) < 0.5 ? `moderate ${r > 0 ? 'positive' : 'negative'}` : `strong ${r > 0 ? 'positive' : 'negative'}`;

export function groupSummary(rows: ResultRow[], minGroup = 0) {
  return GROUPS.map((g) => {
    const inG = rows.filter((r) => r.group === g.key && r.grade);
    const n = inG.length;
    const passed = inG.filter((r) => r.grade !== 'U');
    const hidden = n > 0 && n < minGroup;
    const c = (gr: Grade) => (hidden ? 0 : inG.filter((r) => r.grade === gr).length);
    const dist = { U: c('U'), '3': c('3'), '4': c('4'), '5': c('5') };
    return {
      key: g.key, label: g.label, n, hidden,
      passRate: n && !hidden ? Math.round((passed.length / n) * 100) : null,
      avgPassed: passed.length && !hidden ? round1(passed.reduce((a, r) => a + GRADE_VALUE[r.grade!], 0) / passed.length) : null,
      ...dist,
    };
  });
}

export function correlationSummary(rows: ResultRow[]) {
  const rep = rows.filter((r) => r.grade);
  const rho = spearman(rep.map((r) => r.attended), rep.map((r) => GRADE_VALUE[r.grade!]));
  const si = rep.filter((r) => r.attended > 0), no = rep.filter((r) => r.attended === 0);
  const pass = (x: ResultRow[]) => (x.length ? Math.round((x.filter((r) => r.grade !== 'U').length / x.length) * 100) : null);
  return { total: rows.length, reported: rep.length, responseRate: rows.length ? Math.round((rep.length / rows.length) * 100) : 0, rho, passSI: pass(si), passNoSI: pass(no), nSI: si.length, nNoSI: no.length };
}

export function evaluationSummary(db: DB, courseIds: string[], leaderIds?: string[]) {
  const evs = db.evaluations.filter((e) => courseIds.includes(e.courseId) && (!leaderIds || leaderIds.includes(e.leaderId)));
  const leaders = Array.from(new Set([...courseIds.flatMap((c) => leadersOfCourse(db, c)), ...evs.map((e) => e.leaderId)])).filter((l) => !leaderIds || leaderIds.includes(l));
  return leaders.map((l) => {
    const le = evs.filter((e) => e.leaderId === l);
    const questions = db.evaluationTemplate.map((q) => {
      const ans = le.map((e) => e.answers[q.id]).filter((a) => a !== undefined && a !== '');
      if (q.type === 'rating') {
        const nums = ans.map(Number);
        return { q, avg: nums.length ? round1(nums.reduce((a, b) => a + b, 0) / nums.length) : null, n: nums.length, dist: [1, 2, 3, 4, 5].map((v) => nums.filter((x) => x === v).length), texts: [] as string[], counts: {} as Record<string, number> };
      }
      if (q.type === 'choice') {
        return { q, avg: null, n: ans.length, dist: [], texts: [], counts: Object.fromEntries((q.options ?? []).map((o) => [o, ans.filter((a) => a === o).length])) };
      }
      return { q, avg: null, n: ans.length, dist: [], texts: ans.map(String), counts: {} };
    });
    return { leaderId: l, n: le.length, questions };
  }).filter((x) => x.n > 0 || !leaderIds);
}
