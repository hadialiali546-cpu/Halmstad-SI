// Pure, derived calculations. All dashboards use these so numbers stay consistent.
import { addMinutes, format, isSameMonth, parseISO } from 'date-fns';
import type {
  AttendanceRecord, CoachReportMetrics, DB, LeaderReportMetrics, MonthlyReport, ReportLine,
  SISession, SessionStatus, User, Observation,
} from './types';

export const monthKey = (d: Date | string) => format(typeof d === 'string' ? parseISO(d) : d, 'yyyy-MM');
export const monthLabel = (key: string) => format(parseISO(key + '-01'), 'MMMM yyyy');
export const semesterOf = (d: Date | string) => {
  const date = typeof d === 'string' ? parseISO(d) : d;
  const m = date.getMonth();
  return m >= 7 ? `HT${date.getFullYear()}` : `VT${date.getFullYear()}`; // Autumn = HT, Spring = VT
};
export const semesterLabel = (s: string) => (s.startsWith('HT') ? `Autumn ${s.slice(2)} (HT)` : `Spring ${s.slice(2)} (VT)`);

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function attendanceMap(db: DB): Map<string, AttendanceRecord> {
  const m = new Map<string, AttendanceRecord>();
  db.attendance.forEach((a) => m.set(a.sessionId, a));
  return m;
}

export const sessionEnd = (s: SISession) => addMinutes(parseISO(s.start), s.durationMin);

export function sessionStatus(s: SISession, att: Map<string, AttendanceRecord>, now = new Date()): SessionStatus {
  if (s.cancelled) return 'cancelled';
  if (att.has(s.id)) return 'completed';
  if (sessionEnd(s) < now) return 'attendance_pending';
  return 'scheduled';
}

export const userById = (db: DB, id: string): User | undefined => db.users.find((u) => u.id === id);
export const userName = (db: DB, id: string) => userById(db, id)?.name ?? 'Unknown';
export const courseById = (db: DB, id: string) => db.courses.find((c) => c.id === id);
export const courseName = (db: DB, id: string) => courseById(db, id)?.name ?? 'Unknown course';

export const leadersOfCourse = (db: DB, courseId: string) =>
  db.courseAssignments.filter((a) => a.courseId === courseId).map((a) => a.leaderId);
export const coursesOfLeader = (db: DB, leaderId: string) =>
  db.courseAssignments.filter((a) => a.leaderId === leaderId).map((a) => a.courseId);
export const coachOfLeader = (db: DB, leaderId: string) => db.coachAssignments.find((a) => a.leaderId === leaderId)?.coachId;
export const leadersOfCoach = (db: DB, coachId: string) =>
  db.coachAssignments.filter((a) => a.coachId === coachId).map((a) => a.leaderId);
export const coursesOfStudent = (db: DB, studentId: string) =>
  db.enrollments.filter((e) => e.studentId === studentId).map((e) => e.courseId);
export const studentsOfCourse = (db: DB, courseId: string) =>
  db.enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentId);

export const usersByRole = (db: DB, role: User['role']) => db.users.filter((u) => u.role === role);

/** Aggregate stats for a set of sessions */
export function sessionStats(sessions: SISession[], att: Map<string, AttendanceRecord>, now = new Date()) {
  let completed = 0, attendance = 0, minutes = 0, pending = 0, cancelled = 0, scheduled = 0;
  for (const s of sessions) {
    const st = sessionStatus(s, att, now);
    if (st === 'completed') {
      completed++;
      attendance += att.get(s.id)!.count;
      minutes += s.durationMin;
    } else if (st === 'attendance_pending') pending++;
    else if (st === 'cancelled') cancelled++;
    else scheduled++;
  }
  return {
    completed, attendance, pending, cancelled, scheduled,
    hours: round1(minutes / 60),
    avg: completed ? round1(attendance / completed) : 0,
  };
}

export function observationsForPeriod(db: DB, period = 'HT2026'): Observation[] {
  return db.observations.filter((o) => o.period === period);
}

export function observationCompletion(db: DB, leaderIds?: string[]) {
  const obs = db.observations.filter((o) => !leaderIds || leaderIds.includes(o.leaderId));
  const done = obs.filter((o) => o.status === 'completed').length;
  return { done, total: obs.length, rate: obs.length ? Math.round((done / obs.length) * 100) : 0 };
}

/** Unique named students reached across a set of sessions (attendance instances ≠ unique students) */
export function uniqueStudents(sessions: SISession[], att: Map<string, AttendanceRecord>) {
  const set = new Set<string>();
  sessions.forEach((s) => att.get(s.id)?.studentIds?.forEach((id) => set.add(id)));
  return set.size;
}

// ---------- Monthly report generation ----------

export function leaderReportData(db: DB, leaderId: string, month: string, now = new Date()) {
  const att = attendanceMap(db);
  const sessions = db.sessions.filter((s) => s.leaderId === leaderId && monthKey(s.start) === month);
  const completed = sessions.filter((s) => sessionStatus(s, att, now) === 'completed');
  const cancelled = sessions.filter((s) => s.cancelled).length;
  const totalAttendance = completed.reduce((n, s) => n + att.get(s.id)!.count, 0);
  const minutes = completed.reduce((n, s) => n + s.durationMin, 0);
  const courseIds = Array.from(new Set([...coursesOfLeader(db, leaderId), ...sessions.map((s) => s.courseId)]));

  const metrics: LeaderReportMetrics = {
    kind: 'leader',
    courseIds,
    sessionIds: completed.map((s) => s.id),
    sessionsCompleted: completed.length,
    sessionHours: round1(minutes / 60),
    totalAttendance,
    avgAttendance: completed.length ? round1(totalAttendance / completed.length) : 0,
    cancelledSessions: cancelled,
  };

  const lines: ReportLine[] = [];
  if (completed.length) {
    lines.push({ category: 'SI session', hours: metrics.sessionHours, detail: `${completed.length} delivered sessions` });
    lines.push({
      category: 'Session preparation',
      hours: round1(completed.length * db.settings.prepHoursPerSession),
      detail: `${db.settings.prepHoursPerSession} h per delivered session (demo rule)`,
    });
  }
  const edu = db.eduActivities.filter(
    (e) => e.status === 'completed' && e.attendedIds.includes(leaderId) && monthKey(e.start) === month,
  );
  if (edu.length) {
    lines.push({
      category: 'EDU participation',
      hours: round1(edu.reduce((n, e) => n + e.durationMin, 0) / 60),
      detail: edu.map((e) => e.title).join(', '),
    });
  }
  db.workActivities
    .filter((w) => w.userId === leaderId && monthKey(w.date) === month)
    .forEach((w) => lines.push({ category: w.category, hours: w.hours, detail: w.description }));

  return { metrics, lines };
}

export function coachReportData(db: DB, coachId: string, month: string) {
  const obs = db.observations.filter((o) => o.coachId === coachId && o.status === 'completed' && o.date && monthKey(o.date) === month);
  const edu = db.eduActivities.filter((e) => e.coachId === coachId && e.status === 'completed' && monthKey(e.start) === month);
  const surveys = db.surveys.filter((s) => s.coachId === coachId && s.sentAt && monthKey(s.sentAt) === month);
  const acts = db.workActivities.filter((w) => w.userId === coachId && monthKey(w.date) === month);

  const metrics: CoachReportMetrics = {
    kind: 'coach',
    observationIds: obs.map((o) => o.id),
    eduIds: edu.map((e) => e.id),
    surveyIds: surveys.map((s) => s.id),
    activityIds: acts.map((a) => a.id),
    observationsCompleted: obs.length,
    eduActivities: edu.length,
    surveysSent: surveys.length,
    leadersSupported: leadersOfCoach(db, coachId).length,
  };
  const lines: ReportLine[] = [];
  if (obs.length)
    lines.push({
      category: 'Observation',
      hours: round1(obs.length * db.settings.observationHours),
      detail: `${obs.length} observation(s) incl. feedback · ${db.settings.observationHours} h each (demo rule)`,
    });
  if (edu.length)
    lines.push({
      category: 'EDU facilitation',
      hours: round1(edu.reduce((n, e) => n + e.durationMin / 60 + db.settings.eduPrepHours, 0)),
      detail: edu.map((e) => e.title).join(', '),
    });
  if (surveys.length)
    lines.push({
      category: 'Survey work',
      hours: round1(surveys.length * db.settings.surveyHours),
      detail: surveys.map((s) => s.title).join(', '),
    });
  acts.forEach((w) => lines.push({ category: w.category, hours: w.hours, detail: w.description }));
  return { metrics, lines };
}

export const reportHours = (r: Pick<MonthlyReport, 'lines'>) => round1(r.lines.reduce((n, l) => n + l.hours, 0));

export function buildReport(db: DB, ownerId: string, month: string, now = new Date()): MonthlyReport {
  const owner = userById(db, ownerId)!;
  const role = owner.role === 'coach' ? 'coach' : 'leader';
  const { metrics, lines } = role === 'leader' ? leaderReportData(db, ownerId, month, now) : coachReportData(db, ownerId, month);
  return {
    id: `rep-${ownerId}-${month}`,
    ownerId,
    role,
    month,
    status: 'draft',
    generatedAt: now.toISOString(),
    metrics,
    lines,
    notes: '',
    reflections: '',
    history: [{ at: now.toISOString(), byId: ownerId, action: 'generated' }],
  };
}

export const findReport = (db: DB, ownerId: string, month: string) =>
  db.reports.find((r) => r.ownerId === ownerId && r.month === month);

export function sameMonth(a: string, b: Date) {
  return isSameMonth(parseISO(a), b);
}

/** Sessions a student attended in the last 14 days and has not yet rated */
export function feedbackDue(db: DB, studentId: string, now = new Date()): SISession[] {
  const att = attendanceMap(db);
  const cutoff = now.getTime() - 14 * 24 * 3600 * 1000;
  return db.sessions.filter((s) => {
    const end = sessionEnd(s);
    if (s.cancelled || end > now || end.getTime() < cutoff) return false;
    const was = att.get(s.id)?.studentIds?.includes(studentId) || s.checkin?.studentIds.includes(studentId);
    return was && !db.feedback.some((f) => f.sessionId === s.id && f.studentId === studentId);
  }).reverse();
}

/** Sessions with an open check-in that the student can join */
export function openCheckins(db: DB, studentId: string): SISession[] {
  const courses = coursesOfStudent(db, studentId);
  return db.sessions.filter((s) => s.checkin && !s.checkin.closedAt && courses.includes(s.courseId));
}

export function avgRating(db: DB, sessionIds: Set<string>) {
  const fb = db.feedback.filter((f) => sessionIds.has(f.sessionId));
  return { n: fb.length, avg: fb.length ? round1(fb.reduce((a, f) => a + f.rating, 0) / fb.length) : 0 };
}
