// Export datasets. Column keys are stable; labels are configurable per dataset so they can
// later match approved university templates.
import { addMinutes, format, parseISO } from 'date-fns';
import { uniqueStudents, attendanceMap, courseName, leadersOfCourse, monthKey, monthLabel, reportHours, semesterOf, sessionStatus, userName, round1 } from '@/data/calc';
import type { CoachReportMetrics, DB, ExportColumnConfig, LeaderReportMetrics } from '@/data/types';
import type { Row } from './files';

export interface Dataset {
  key: string;
  name: string;
  description: string;
  columns: ExportColumnConfig[];
  rows: (db: DB, now: Date) => Row[];
}

const cols = (pairs: [string, string][]): ExportColumnConfig[] => pairs.map(([key, label]) => ({ key, label, include: true }));

export const DATASETS: Dataset[] = [
  {
    key: 'leader_reports', name: 'Monthly SI leader reports', description: 'One row per SI leader report and month.',
    columns: cols([['name', 'SI leader'], ['month', 'Reporting month'], ['status', 'Status'], ['courses', 'Courses'], ['sessions', 'Sessions completed'], ['sessionHours', 'Session hours'], ['attendance', 'Total attendance'], ['avg', 'Avg attendance'], ['hours', 'Compensable hours'], ['submitted', 'Submitted'], ['decided', 'Decision date']]),
    rows: (db) => db.reports.filter((r) => r.role === 'leader').map((r) => {
      const m = r.metrics as LeaderReportMetrics;
      return {
        name: userName(db, r.ownerId), month: r.month, status: r.status, courses: m.courseIds.map((c) => courseName(db, c)).join('; '),
        sessions: m.sessionsCompleted, sessionHours: m.sessionHours, attendance: m.totalAttendance, avg: m.avgAttendance, hours: reportHours(r),
        submitted: r.submittedAt ? format(parseISO(r.submittedAt), 'yyyy-MM-dd') : '', decided: r.decidedAt ? format(parseISO(r.decidedAt), 'yyyy-MM-dd') : '',
      };
    }),
  },
  {
    key: 'coach_reports', name: 'Monthly SI coach reports', description: 'One row per SI coach report and month.',
    columns: cols([['name', 'SI coach'], ['month', 'Reporting month'], ['status', 'Status'], ['observations', 'Observations'], ['edu', 'EDU activities'], ['surveys', 'Surveys sent'], ['leaders', 'Leaders supported'], ['hours', 'Compensable hours'], ['submitted', 'Submitted']]),
    rows: (db) => db.reports.filter((r) => r.role === 'coach').map((r) => {
      const m = r.metrics as CoachReportMetrics;
      return {
        name: userName(db, r.ownerId), month: r.month, status: r.status, observations: m.observationsCompleted, edu: m.eduActivities, surveys: m.surveysSent,
        leaders: m.leadersSupported, hours: reportHours(r), submitted: r.submittedAt ? format(parseISO(r.submittedAt), 'yyyy-MM-dd') : '',
      };
    }),
  },
  {
    key: 'course_stats', name: 'Course attendance statistics', description: 'Totals per SI course for all recorded sessions.',
    columns: cols([['code', 'Course code'], ['course', 'Course name'], ['faculty', 'Faculty'], ['leaders', 'SI leaders'], ['sessions', 'Sessions completed'], ['attendance', 'Attendance instances'], ['unique', 'Unique students'], ['avg', 'Avg attendance'], ['hours', 'Session hours'], ['pending', 'Attendance pending'], ['cancelled', 'Cancelled']]),
    rows: (db, now) => {
      const att = attendanceMap(db);
      return db.courses.map((c) => {
        const ss = db.sessions.filter((s) => s.courseId === c.id);
        const done = ss.filter((s) => sessionStatus(s, att, now) === 'completed');
        const a = done.reduce((n, s) => n + att.get(s.id)!.count, 0);
        return {
          code: c.code, course: c.name, faculty: c.faculty, leaders: leadersOfCourse(db, c.id).map((l) => userName(db, l)).join('; '),
          sessions: done.length, attendance: a, unique: uniqueStudents(done, att), avg: done.length ? round1(a / done.length) : 0, hours: round1(done.reduce((n, s) => n + s.durationMin, 0) / 60),
          pending: ss.filter((s) => sessionStatus(s, att, now) === 'attendance_pending').length, cancelled: ss.filter((s) => s.cancelled).length,
        };
      });
    },
  },
  {
    key: 'semester_summary', name: 'Semester summary', description: 'Per semester, month and course.',
    columns: cols([['semester', 'Semester'], ['month', 'Month'], ['code', 'Course code'], ['course', 'Course'], ['sessions', 'Sessions'], ['attendance', 'Attendance instances'], ['hours', 'Session hours']]),
    rows: (db, now) => {
      const att = attendanceMap(db);
      const map = new Map<string, Row>();
      db.sessions.forEach((s) => {
        if (sessionStatus(s, att, now) !== 'completed') return;
        const k = `${monthKey(s.start)}|${s.courseId}`;
        const c = db.courses.find((x) => x.id === s.courseId)!;
        const r = map.get(k) ?? { semester: semesterOf(s.start), month: monthKey(s.start), code: c.code, course: c.name, sessions: 0, attendance: 0, hours: 0 };
        r.sessions = (r.sessions as number) + 1;
        r.attendance = (r.attendance as number) + att.get(s.id)!.count;
        r.hours = round1((r.hours as number) + s.durationMin / 60);
        map.set(k, r);
      });
      return [...map.values()].sort((a, b) => `${a.month}${a.code}`.localeCompare(`${b.month}${b.code}`));
    },
  },
  {
    key: 'approved_records', name: 'Approved administrative records', description: 'Only lines from supervisor-approved reports.',
    columns: cols([['employee', 'Employee name'], ['email', 'Email'], ['role', 'Role'], ['period', 'Reporting period'], ['category', 'Work category'], ['hours', 'Hours'], ['approvedBy', 'Approved by'], ['approvedAt', 'Approval date']]),
    rows: (db) => approvedLines(db),
  },
];

export function approvedLines(db: DB): Row[] {
  return db.reports.filter((r) => r.status === 'approved').flatMap((r) =>
    r.lines.map((l) => ({
      employee: userName(db, r.ownerId), email: db.users.find((u) => u.id === r.ownerId)?.email ?? '', role: r.role === 'leader' ? 'SI Leader' : 'SI Coach',
      period: r.month, category: l.category, hours: l.hours, approvedBy: userName(db, r.decidedById ?? ''),
      approvedAt: r.decidedAt ? format(parseISO(r.decidedAt), 'yyyy-MM-dd') : '',
    })),
  );
}

export function configuredColumns(db: DB, ds: Dataset): ExportColumnConfig[] {
  const saved = db.exportConfigs[ds.key];
  if (!saved) return ds.columns;
  // merge to tolerate new columns added later
  return ds.columns.map((c) => saved.find((s) => s.key === c.key) ?? c);
}

export function applyColumns(rows: Row[], columns: ExportColumnConfig[]) {
  const inc = columns.filter((c) => c.include);
  return { headers: inc.map((c) => c.label), rows: rows.map((r) => Object.fromEntries(inc.map((c) => [c.label, r[c.key] ?? '']))) };
}

export const TEMPLATE_HEADERS = ['Name', 'Role', 'Course code', 'Course name', 'Session date', 'Session duration', 'Attendance'];
export function templateRows(): Row[] {
  const d = (days: number, h: number) => format(addMinutes(new Date(new Date().setHours(h, 0, 0, 0)), -days * 24 * 60), 'yyyy-MM-dd HH:mm');
  return [
    { Name: 'Elin Johansson', Role: 'SI Leader', 'Course code': 'MA1001', 'Course name': 'Mathematics 1', 'Session date': d(40, 10), 'Session duration': 105, Attendance: 12 },
    { Name: 'Klara Öberg', Role: 'SI Leader', 'Course code': 'FY1003', 'Course name': 'Physics', 'Session date': d(38, 13), 'Session duration': 90, Attendance: 9 },
    { Name: 'Klara Öberg', Role: 'SI Leader', 'Course code': 'FY1003', 'Course name': 'Physics', 'Session date': d(31, 13), 'Session duration': 90, Attendance: 11 },
    { Name: 'Klara Öberg', Role: 'SI Leader', 'Course code': 'FY1003', 'Course name': 'Physics', 'Session date': d(31, 13), 'Session duration': 90, Attendance: 11 },
    { Name: 'Sam Lindgren', Role: 'SI Leader', 'Course code': 'XX9999', 'Course name': 'Unknown course', 'Session date': d(30, 10), 'Session duration': 120, Attendance: 7 },
    { Name: '', Role: 'SI Leader', 'Course code': 'DT1010', 'Course name': 'Programming Fundamentals', 'Session date': d(29, 15), 'Session duration': 105, Attendance: '' },
  ];
}
export { monthLabel };
