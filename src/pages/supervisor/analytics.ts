import { format, parseISO, startOfWeek } from 'date-fns';
import { attendanceMap, monthKey, round1, semesterOf, sessionStatus, userName, usersByRole } from '@/data/calc';
import type { DB, SISession } from '@/data/types';

export const COURSE_COLORS: Record<string, string> = { 'c-ma': '#12304A', 'c-pf': '#008D95', 'c-fy': '#6C8EAD', 'c-ie': '#C08A3E' };
export const colorFor = (courseId: string, i = 0) => COURSE_COLORS[courseId] ?? ['#12304A', '#008D95', '#6C8EAD', '#C08A3E', '#7A6BA8'][i % 5];

export interface Filters { month: string; semester: string; course: string; faculty: string; leader: string }
export const emptyFilters: Filters = { month: 'all', semester: 'all', course: 'all', faculty: 'all', leader: 'all' };

export function filterSessions(db: DB, f: Filters): SISession[] {
  return db.sessions.filter((s) => {
    if (f.month !== 'all' && monthKey(s.start) !== f.month) return false;
    if (f.semester !== 'all' && semesterOf(s.start) !== f.semester) return false;
    if (f.course !== 'all' && s.courseId !== f.course) return false;
    if (f.leader !== 'all' && s.leaderId !== f.leader) return false;
    if (f.faculty !== 'all' && db.courses.find((c) => c.id === s.courseId)?.faculty !== f.faculty) return false;
    return true;
  });
}

/** Weekly attendance per course (completed sessions only) */
export function attendanceOverTime(db: DB, sessions: SISession[], now: Date) {
  const att = attendanceMap(db);
  const buckets = new Map<string, Record<string, number | string>>();
  sessions.forEach((s) => {
    if (sessionStatus(s, att, now) !== 'completed') return;
    const wk = format(startOfWeek(parseISO(s.start), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const b = buckets.get(wk) ?? { week: wk, label: format(parseISO(wk), 'd MMM'), total: 0, ...Object.fromEntries(db.courses.map((c) => [c.id, 0])) };
    b[s.courseId] = ((b[s.courseId] as number) ?? 0) + att.get(s.id)!.count;
    b.total = (b.total as number) + att.get(s.id)!.count;
    buckets.set(wk, b);
  });
  return [...buckets.values()].sort((a, b) => String(a.week).localeCompare(String(b.week)));
}

export function perCourse(db: DB, sessions: SISession[], now: Date) {
  const att = attendanceMap(db);
  return db.courses.map((c) => {
    const ss = sessions.filter((s) => s.courseId === c.id);
    const done = ss.filter((s) => sessionStatus(s, att, now) === 'completed');
    const attendance = done.reduce((n, s) => n + att.get(s.id)!.count, 0);
    return {
      id: c.id, name: c.name, code: c.code, short: c.name.replace('Introduction to', 'Intro.').replace('Fundamentals', 'Fund.'),
      sessions: done.length, attendance, avg: done.length ? round1(attendance / done.length) : 0,
      hours: round1(done.reduce((n, s) => n + s.durationMin, 0) / 60),
      pending: ss.filter((s) => sessionStatus(s, att, now) === 'attendance_pending').length,
    };
  }).filter((c) => sessions.some((s) => s.courseId === c.id));
}

export function perLeader(db: DB, sessions: SISession[], now: Date) {
  const att = attendanceMap(db);
  return usersByRole(db, 'leader').map((l) => {
    const ss = sessions.filter((s) => s.leaderId === l.id);
    const done = ss.filter((s) => sessionStatus(s, att, now) === 'completed');
    return {
      id: l.id, name: l.name, short: l.name.split(' ')[0] + ' ' + l.name.split(' ')[1]?.[0] + '.',
      sessions: done.length, attendance: done.reduce((n, s) => n + att.get(s.id)!.count, 0),
      pending: ss.filter((s) => sessionStatus(s, att, now) === 'attendance_pending').length,
    };
  }).filter((r) => sessions.some((s) => s.leaderId === r.id));
}

export function observationByCoach(db: DB, leaderFilter?: string[]) {
  return usersByRole(db, 'coach').map((c) => {
    const obs = db.observations.filter((o) => o.coachId === c.id && (!leaderFilter || leaderFilter.includes(o.leaderId)));
    return {
      name: c.name, completed: obs.filter((o) => o.status === 'completed').length,
      scheduled: obs.filter((o) => o.status === 'scheduled' || o.status === 'draft').length,
      notScheduled: obs.filter((o) => o.status === 'not_scheduled').length,
    };
  });
}

export function reportingStatus(db: DB, months: string[]) {
  const owners = [...usersByRole(db, 'leader'), ...usersByRole(db, 'coach')];
  return months.map((m) => {
    const reps = db.reports.filter((r) => r.month === m);
    return {
      month: format(parseISO(m + '-01'), 'MMM yyyy'),
      Approved: reps.filter((r) => r.status === 'approved').length,
      Submitted: reps.filter((r) => r.status === 'submitted').length,
      Returned: reps.filter((r) => r.status === 'returned').length,
      Draft: reps.filter((r) => r.status === 'draft').length,
      'Not started': owners.length - reps.length,
    };
  });
}

export const REPORT_COLORS = { Approved: '#3E8E63', Submitted: '#E0A23B', Returned: '#C2504A', Draft: '#6C8EAD', 'Not started': '#D5DCE4' };

export function semesters(db: DB) {
  return Array.from(new Set(db.sessions.map((s) => semesterOf(s.start)))).sort();
}
export function months(db: DB) {
  return Array.from(new Set(db.sessions.map((s) => monthKey(s.start)))).sort();
}
export { userName };
