// Deterministic, fictional demo dataset. Generated relative to "now" so the demo always
// shows ~8 weeks of history and ~3 weeks of upcoming activity. All names are fictional.
import {
  addDays, addMinutes, parseISO, addWeeks, format, getDay, setHours, setMinutes, startOfDay, startOfWeek, subDays, subMonths, subWeeks,
} from 'date-fns';
import { attendanceMap, buildReport, monthKey, sessionEnd } from './calc';
import { PLAN_TEMPLATES } from '@/lib/templates';
import type {
  SurveyQuestion,
  AppNotification, AttendanceRecord, Course, DB, EducationActivity, MonthlyReport, Observation, SISession, Survey,
  TimeSlotPreference, TopicRequest, User, WorkActivity,
} from './types';

export const DB_VERSION = 6;

/** Standard end-of-course SI evaluation (editable by the supervisor) */
export const EVALUATION_TEMPLATE: SurveyQuestion[] = [
  { id: 'e1', type: 'rating', text: 'My SI leader created a welcoming and inclusive atmosphere.' },
  { id: 'e2', type: 'rating', text: 'My SI leader encouraged us to work together rather than lecturing.' },
  { id: 'e3', type: 'rating', text: 'The SI sessions helped me understand the course content.' },
  { id: 'e4', type: 'rating', text: 'Overall, how would you rate your SI leader?' },
  { id: 'e5', type: 'choice', text: 'Would you recommend SI to other students?', options: ['Yes', 'Maybe', 'No'] },
  { id: 'e6', type: 'text', text: 'What did your SI leader do particularly well?' },
  { id: 'e7', type: 'text', text: 'What could your SI leader improve?' },
];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const email = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.') + '@demo.hh-si.example';

export const PERSONAS = {
  student: 'stu-emma',
  leader: 'ldr-alex',
  coach: 'coa-robin',
  supervisor: 'sup-sara',
} as const;

const COURSES: Course[] = [
  { id: 'c-ma', code: 'MA1001', name: 'Mathematics 1', faculty: 'Academy of Information Technology', credits: 7.5 },
  { id: 'c-pf', code: 'DT1010', name: 'Programming Fundamentals', faculty: 'Academy of Information Technology', credits: 7.5 },
  { id: 'c-fy', code: 'FY1003', name: 'Physics', faculty: 'Academy of Engineering & Sustainability', credits: 7.5 },
  { id: 'c-ie', code: 'EI1002', name: 'Introduction to Engineering', faculty: 'Academy of Engineering & Sustainability', credits: 7.5 },
];

const leaders: [string, string][] = [
  ['ldr-alex', 'Alex Nilsson'], ['ldr-elin', 'Elin Johansson'], ['ldr-lina', 'Lina Karlsson'], ['ldr-johan', 'Johan Persson'],
  ['ldr-omar', 'Omar Hassan'], ['ldr-maja', 'Maja Eriksson'], ['ldr-viktor', 'Viktor Lund'], ['ldr-sofia', 'Sofia Ahmadi'],
];
const coaches: [string, string][] = [['coa-robin', 'Robin Berg'], ['coa-karin', 'Karin Holm'], ['coa-daniel', 'Daniel Svensson']];
const supervisors: [string, string][] = [['sup-sara', 'Sara Lindholm'], ['sup-per', 'Per Gustafsson']];
const studentNames = [
  'Emma Andersson', 'Oscar Lindqvist', 'Wilma Sjöberg', 'Hugo Bergström', 'Ella Magnusson', 'Liam Jönsson', 'Alva Nyström',
  'William Engström', 'Saga Holmberg', 'Noah Axelsson', 'Elsa Fredriksson', 'Lucas Wallin', 'Astrid Lundgren', 'Elias Sandberg',
  'Freja Mattsson', 'Adam Hedlund', 'Ines Berglund', 'Nils Ekström', 'Leah Abdi', 'Theo Forsberg', 'Moa Danielsson',
  'Isak Hermansson', 'Selma Kovač', 'Arvid Strand', 'Julia Nordin', 'Malte Åkesson', 'Nora Haddad', 'Viggo Sundqvist',
  'Tilde Blom', 'Yusuf Demir',
];
const programmes = ['Computer Science & Engineering', 'Mechanical Engineering', 'Energy Engineering', 'Digital Design & Innovation'];

const courseTopics: Record<string, string[]> = {
  'c-ma': ['Limits and continuity', 'Derivatives and rules', 'Implicit differentiation', 'Optimisation problems', 'Integration basics',
    'Integration by parts', 'Complex numbers', 'Exam-style problems', 'Taylor polynomials', 'Differential equations intro', 'Review session', 'Exam preparation'],
  'c-pf': ['Variables and types', 'Control flow', 'Loops and iteration', 'Functions', 'Lists and dictionaries', 'Debugging strategies',
    'Recursion', 'File handling', 'Classes and objects', 'Testing basics', 'Lab assignment support', 'Exam preparation'],
  'c-fy': ['Units and vectors', 'Kinematics in 1D', 'Projectile motion', "Newton's laws", 'Friction and forces', 'Work and energy',
    'Momentum', 'Rotational motion', 'Oscillations', 'Problem-solving strategies', 'Review session', 'Exam preparation'],
  'c-ie': ['Engineering design process', 'Technical writing', 'Teamwork in projects', 'Sustainability in engineering', 'CAD basics',
    'Project planning', 'Presentation skills', 'Ethics in engineering', 'Report structure', 'Peer review practice', 'Project review', 'Final presentation prep'],
};

export function createSeed(now = new Date()): DB {
  const r = rng(20261015);
  const courses: Course[] = COURSES.map((c) => ({ ...c }));
  const today = startOfDay(now);
  const iso = (d: Date) => d.toISOString();

  // ---- users ----
  const users: User[] = [];
  studentNames.forEach((n, i) =>
    users.push({ id: i === 0 ? 'stu-emma' : `stu-${i}`, name: n, email: email(n), role: 'student', programme: programmes[i % programmes.length], source: 'seed' }),
  );
  leaders.forEach(([id, n]) => users.push({ id, name: n, email: email(n), role: 'leader', source: 'seed' }));
  coaches.forEach(([id, n]) => users.push({ id, name: n, email: email(n), role: 'coach', source: 'seed' }));
  supervisors.forEach(([id, n]) => users.push({ id, name: n, email: email(n), role: 'supervisor', source: 'seed' }));

  const courseAssignments = [
    ['c-ma', 'ldr-alex'], ['c-ma', 'ldr-elin'], ['c-pf', 'ldr-lina'], ['c-pf', 'ldr-johan'],
    ['c-fy', 'ldr-omar'], ['c-fy', 'ldr-maja'], ['c-ie', 'ldr-viktor'], ['c-ie', 'ldr-sofia'],
  ].map(([courseId, leaderId], i) => ({ id: `ca-${i}`, courseId, leaderId }));

  const coachAssignments = [
    ['ldr-alex', 'coa-robin'], ['ldr-lina', 'coa-robin'], ['ldr-omar', 'coa-robin'],
    ['ldr-elin', 'coa-karin'], ['ldr-johan', 'coa-karin'], ['ldr-maja', 'coa-karin'],
    ['ldr-viktor', 'coa-daniel'], ['ldr-sofia', 'coa-daniel'],
  ].map(([leaderId, coachId]) => ({ leaderId, coachId }));

  // Enrollments: Emma takes Mathematics 1 and Programming Fundamentals; others three of the four courses.
  const enrollments: DB['enrollments'] = [
    { studentId: 'stu-emma', courseId: 'c-ma' },
    { studentId: 'stu-emma', courseId: 'c-pf' },
    { studentId: 'stu-emma', courseId: 'c-fy' },
  ];
  const allCourseIds = ['c-ma', 'c-pf', 'c-fy', 'c-ie'];
  users.filter((u) => u.role === 'student' && u.id !== 'stu-emma').forEach((u, i) => {
    allCourseIds.filter((_, k) => k !== (i + 2) % 4).forEach((courseId) => enrollments.push({ studentId: u.id, courseId }));
  });
  // How regularly each student attends SI in each course (fixed, so reach and repeat attendance look realistic):
  // some never come, some drop in occasionally, most regulars come often.
  const neverShare: Record<string, number> = { 'c-ma': 0.12, 'c-pf': 0.2, 'c-fy': 0.32, 'c-ie': 0.38 };
  const engagement = new Map<string, number>();
  // Student "type" across all courses: ~20% never use SI, ~25% drop in occasionally, the rest attend regularly
  const sType = new Map(users.filter((u) => u.role === 'student').map((u) => {
    const x = r();
    return [u.id, u.id === 'stu-emma' ? 'regular' : x < 0.2 ? 'never' : x < 0.45 ? 'occasional' : 'regular'];
  }));
  // occasional students only drop in to one of their courses
  const occasionalCourse = new Map<string, string>();
  enrollments.forEach((e) => { if (sType.get(e.studentId) === 'occasional' && (!occasionalCourse.has(e.studentId) || r() < 0.3)) occasionalCourse.set(e.studentId, e.courseId); });
  enrollments.forEach((e) => {
    const t = sType.get(e.studentId);
    const p = e.studentId === 'stu-emma' ? 0.85
      : t === 'never' ? 0
        : t === 'occasional' ? (occasionalCourse.get(e.studentId) === e.courseId ? 0.06 + r() * 0.12 : 0)
          : r() < neverShare[e.courseId] * 0.6 ? 0 : 0.2 + r() * 0.75;
    engagement.set(`${e.studentId}|${e.courseId}`, p);
  });

  // ---- sessions ----
  const wd = (d: Date) => (getDay(d) + 6) % 7; // Mon=0 … Sun=6
  let prevWork = subDays(today, 1);
  while (wd(prevWork) > 4) prevWork = subDays(prevWork, 1);
  const alexA = wd(prevWork); // so "yesterday's session" (previous working day) exists
  const alexB = wd(today) <= 4 ? wd(today) : 0; // "session today at 13:00"

  type Slot = { leaderId: string; courseId: string; day: number; hour: number; min: number; dur: number; loc: string };
  const slots: Slot[] = [
    { leaderId: 'ldr-alex', courseId: 'c-ma', day: alexA, hour: 14, min: 0, dur: 120, loc: 'Building E, Room E305' },
    { leaderId: 'ldr-alex', courseId: 'c-ma', day: alexB === alexA ? (alexA + 2) % 5 : alexB, hour: 13, min: 0, dur: 120, loc: 'Library, Group Room 4' },
    { leaderId: 'ldr-elin', courseId: 'c-ma', day: 3, hour: 10, min: 15, dur: 105, loc: 'Building E, Room E211' },
    { leaderId: 'ldr-lina', courseId: 'c-pf', day: 1, hour: 15, min: 15, dur: 105, loc: 'Building O, Lab O118' },
    { leaderId: 'ldr-johan', courseId: 'c-pf', day: 4, hour: 10, min: 0, dur: 120, loc: 'Building O, Lab O120' },
    { leaderId: 'ldr-omar', courseId: 'c-fy', day: 2, hour: 10, min: 15, dur: 105, loc: 'Building J, Room J214' },
    { leaderId: 'ldr-maja', courseId: 'c-fy', day: 3, hour: 15, min: 15, dur: 105, loc: 'Building J, Room J110' },
    { leaderId: 'ldr-viktor', courseId: 'c-ie', day: 0, hour: 10, min: 15, dur: 90, loc: 'Fabriken, Studio 2' },
    { leaderId: 'ldr-sofia', courseId: 'c-ie', day: 2, hour: 13, min: 15, dur: 90, loc: 'Fabriken, Studio 3' },
  ];
  const baseAtt: Record<string, number> = { 'c-ma': 13, 'c-pf': 11, 'c-fy': 8, 'c-ie': 9 };
  const weekStart = startOfWeek(subWeeks(today, 8), { weekStartsOn: 1 });
  const sessions: SISession[] = [];
  const attendance: AttendanceRecord[] = [];
  const cancelKeys = new Set(['ldr-maja-2', 'ldr-viktor-4', 'ldr-lina-6', 'ldr-sofia-10']);

  // Physics ran in study period 1 and has just finished; the other courses run until January.
  const physicsEnd = subDays(today, 3);
  courses.forEach((c) => { c.endDate = format(c.id === 'c-fy' ? physicsEnd : addDays(today, 85), 'yyyy-MM-dd'); });
  for (let w = 0; w < 12; w++) {
    slots.forEach((sl, si) => {
      const start = setMinutes(setHours(addDays(addWeeks(weekStart, w), sl.day), sl.hour), sl.min);
      if (sl.courseId === 'c-fy' && start > physicsEnd) return;
      const topics = courseTopics[sl.courseId];
      const s: SISession = {
        id: `ses-${w}-${si}`,
        courseId: sl.courseId,
        leaderId: sl.leaderId,
        start: iso(start),
        durationMin: sl.dur,
        location: sl.loc,
        topic: si === 1 ? `Practice workshop: ${topics[w % topics.length]}` : topics[w % topics.length],
        source: 'seed',
      };
      if (cancelKeys.has(`${sl.leaderId}-${w}`)) s.cancelled = true;
      sessions.push(s);
    });
  }
  sessions.sort((a, b) => a.start.localeCompare(b.start));

  // Extra session announced by Lina (to show "new session" notifications)
  const extraStart = setMinutes(setHours(addDays(startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 }), 3), 17), 0);
  sessions.push({
    id: 'ses-extra-pf', courseId: 'c-pf', leaderId: 'ldr-lina', start: iso(extraStart), durationMin: 120,
    location: 'Building O, Lab O118', topic: 'Extra session: lab assignment 3 support', source: 'leader',
  });

  // Attendance for past sessions, leaving a few realistic gaps (pending attendance)
  const past = (s: SISession) => sessionEnd(s) < now;
  const pendingIds = new Set<string>();
  const lastPast = (leaderId: string, n: number) =>
    sessions.filter((s) => s.leaderId === leaderId && past(s) && !s.cancelled).slice(-n).forEach((s) => pendingIds.add(s.id));
  // Alex: the previous-working-day session (and today's if already finished)
  sessions
    .filter((s) => s.leaderId === 'ldr-alex' && past(s) && startOfDay(new Date(s.start)) >= startOfDay(prevWork))
    .forEach((s) => pendingIds.add(s.id));
  lastPast('ldr-omar', 2);
  lastPast('ldr-johan', 1);

  const notes = ['Good energy, many questions about the last lecture.', 'Worked through old exam problems in groups.',
    'Students requested more practice problems.', 'Smaller group due to lab deadline.', '', '', ''];
  sessions.forEach((s, i) => {
    if (!past(s) || s.cancelled || pendingIds.has(s.id)) return;
    const wIdx = Number(s.id.split('-')[1]) || 0;
    const trend = Math.round(wIdx * 0.35);
    const roster = enrollments.filter((e) => e.courseId === s.courseId).map((e) => e.studentId);
    const boost = 1 + trend * 0.03; // attendance grows slightly over the term
    // Alex runs two sessions a week, so each one gets a bit fewer of the regulars
    const split = s.leaderId === 'ldr-alex' ? 0.75 : 1;
    const studentIds = roster.filter((id) => r() < Math.min(0.97, (engagement.get(`${id}|${s.courseId}`) ?? 0) * boost * split));
    void baseAtt;
    const guests = r() < 0.15 ? 1 : 0;
    const rec = addMinutes(new Date(s.start), s.durationMin + 30 + Math.round(r() * 600));
    attendance.push({
      id: `att-${s.id}`, sessionId: s.id, count: studentIds.length + guests, studentIds, guests, notes: notes[i % notes.length],
      recordedBy: s.leaderId, recordedAt: iso(rec),
    });
  });

  // ---- topics ----
  const studentIds = users.filter((u) => u.role === 'student').map((u) => u.id);
  const pick = (n: number) => studentIds.filter(() => r() < n / studentIds.length).slice(0, n);
  const topicSeed: [string, string, string, number, TopicRequest['status']][] = [
    ['c-ma', 'stu-3', 'Integration by substitution', 9, 'open'],
    ['c-ma', 'stu-emma', 'How to choose the right method for limits', 6, 'open'],
    ['c-ma', 'stu-5', 'Complex numbers in polar form', 4, 'planned'],
    ['c-ma', 'stu-8', 'Old exam: optimisation questions', 11, 'addressed'],
    ['c-pf', 'stu-4', 'Recursion — when and why?', 8, 'open'],
    ['c-pf', 'stu-7', 'Reading error messages and stack traces', 5, 'planned'],
    ['c-pf', 'stu-emma', 'Difference between lists and tuples', 3, 'open'],
    ['c-fy', 'stu-2', 'Free-body diagrams step by step', 7, 'open'],
    ['c-fy', 'stu-6', 'Energy conservation with friction', 4, 'not_selected'],
    ['c-ie', 'stu-9', 'Structure of the project report', 6, 'open'],
  ];
  const topics: TopicRequest[] = topicSeed.map(([courseId, studentId, text, votes, status], i) => ({
    id: `top-${i}`, courseId, studentId, text, status,
    createdAt: iso(subDays(now, 2 + i * 2)),
    voterIds: Array.from(new Set([studentId, ...pick(votes * 2)])).slice(0, votes),
  }));

  // ---- time slots & preferences ----
  const timeSlots = [
    { id: 'slot-mon', label: 'Monday 14:00–16:00' },
    { id: 'slot-tue', label: 'Tuesday 10:00–12:00' },
    { id: 'slot-wed', label: 'Wednesday 13:00–15:00' },
    { id: 'slot-thu', label: 'Thursday 15:00–17:00' },
    { id: 'slot-fri', label: 'Friday 10:00–12:00' },
    { id: 'slot-wed-eve', label: 'Wednesday 17:00–19:00' },
  ];
  const weights = [0.55, 0.35, 0.6, 0.3, 0.15, 0.25];
  const timePrefs: TimeSlotPreference[] = [];
  enrollments.forEach((e) => {
    if (e.studentId === 'stu-emma') return; // Emma sets her own during the demo
    const chosen = timeSlots.filter((_, i) => r() < weights[i]).map((s) => s.id);
    if (chosen.length) timePrefs.push({ studentId: e.studentId, courseId: e.courseId, slotIds: chosen });
  });

  // ---- observations (two per leader per period) ----
  const period = 'HT2026';
  const leaderCourse = (id: string) => courseAssignments.find((a) => a.leaderId === id)!.courseId;
  const coachOf = (id: string) => coachAssignments.find((a) => a.leaderId === id)!.coachId;
  const sessionOn = (leaderId: string, weeksAgo: number) => {
    const list = sessions.filter((s) => s.leaderId === leaderId && past(s) && !s.cancelled && !pendingIds.has(s.id));
    return list[Math.max(0, list.length - 1 - weeksAgo)];
  };
  const obsTexts = {
    description: 'Session followed a planned structure: warm-up question, group problem solving, and a summary round.',
    wentWell: 'Clear structure and good use of redirecting questions back to the group. Students explained solutions to each other.',
    improve: 'A few students stayed quiet; consider assigning roles in small groups. Time-keeping in the last segment.',
    recommendations: 'Try the "think–pair–share" technique for the opening task. Prepare 2–3 fallback questions.',
    reflections: 'Strong development since the start of term. Follow up on group-role strategy in the next coaching meeting.',
  };
  const obsSpec: [string, 1 | 2, Observation['status'], number | null][] = [
    ['ldr-alex', 1, 'completed', 5], ['ldr-alex', 2, 'scheduled', null],
    ['ldr-lina', 1, 'completed', 6], ['ldr-lina', 2, 'completed', 1],
    ['ldr-omar', 1, 'not_scheduled', null], ['ldr-omar', 2, 'not_scheduled', null],
    ['ldr-elin', 1, 'completed', 4], ['ldr-elin', 2, 'not_scheduled', null],
    ['ldr-johan', 1, 'completed', 5], ['ldr-johan', 2, 'scheduled', null],
    ['ldr-maja', 1, 'completed', 6], ['ldr-maja', 2, 'completed', 2],
    ['ldr-viktor', 1, 'completed', 3], ['ldr-viktor', 2, 'not_scheduled', null],
    ['ldr-sofia', 1, 'scheduled', null], ['ldr-sofia', 2, 'not_scheduled', null],
  ];
  const observations: Observation[] = obsSpec.map(([leaderId, number, status, weeksAgo]) => {
    const base: Observation = {
      id: `obs-${leaderId}-${number}`, leaderId, coachId: coachOf(leaderId), courseId: leaderCourse(leaderId), number, period, status,
      description: '', wentWell: '', improve: '', recommendations: '', reflections: '',
    };
    if (status === 'completed' && weeksAgo !== null) {
      const s = sessionOn(leaderId, weeksAgo);
      const a = attendance.find((x) => x.sessionId === s.id);
      return { ...base, ...obsTexts, date: format(new Date(s.start), 'yyyy-MM-dd'), attendees: a?.count ?? 10, completedAt: iso(addDays(new Date(s.start), 1)) };
    }
    if (status === 'scheduled') {
      const future = leaderId === 'ldr-alex' ? today : addDays(today, leaderId === 'ldr-johan' ? 8 : 12);
      return { ...base, date: format(future, 'yyyy-MM-dd') };
    }
    return base;
  });

  // ---- EDU1 / EDU2 ----
  const allLeaderIds = leaders.map(([id]) => id);
  let friday = addDays(today, 1);
  while (wd(friday) !== 4) friday = addDays(friday, 1);
  const at = (d: Date, h: number, m = 0) => iso(setMinutes(setHours(d, h), m));
  const eduActivities: EducationActivity[] = [
    {
      id: 'edu-1', categoryId: 'EDU1', title: 'EDU1 — Introduction to SI leadership', start: at(addDays(weekStart, -3), 9),
      durationMin: 360, location: 'Building O, Room O201', coachId: 'coa-robin',
      description: 'Full-day introduction: SI philosophy, session planning, collaborative learning techniques.',
      participantIds: allLeaderIds, attendedIds: allLeaderIds, status: 'completed', remindersSent: 2,
    },
    {
      id: 'edu-2', categoryId: 'EDU1', title: 'EDU1 — Catch-up module', start: at(addWeeks(weekStart, 2), 13),
      durationMin: 180, location: 'Building E, Room E104', coachId: 'coa-karin',
      description: 'Shortened EDU1 module for leaders who joined later in the term.',
      participantIds: ['ldr-sofia', 'ldr-viktor'], attendedIds: ['ldr-sofia', 'ldr-viktor'], status: 'completed', remindersSent: 1,
    },
    {
      id: 'edu-3', categoryId: 'EDU2', title: 'EDU2 — Questioning techniques workshop', start: at(subDays(today, 9), 13),
      durationMin: 180, location: 'Library, Seminar Room 1', coachId: 'coa-robin',
      description: 'Follow-up workshop: open questions, redirecting, and handling silent groups.',
      participantIds: allLeaderIds, attendedIds: allLeaderIds.filter((id) => id !== 'ldr-omar' && id !== 'ldr-johan'), status: 'completed', remindersSent: 1,
    },
    {
      id: 'edu-4', categoryId: 'EDU2', title: 'EDU2 — Exam preparation sessions', start: at(friday, 13),
      durationMin: 180, location: 'Building E, Room E104', coachId: 'coa-robin',
      description: 'Planning effective exam-preparation SI sessions and dealing with stress in groups.',
      participantIds: allLeaderIds, attendedIds: [], status: 'scheduled', remindersSent: 0,
    },
    {
      id: 'edu-5', categoryId: 'EDU2', title: 'EDU2 — Peer reflection circle', start: at(addDays(friday, 21), 10),
      durationMin: 120, location: 'Fabriken, Studio 1', coachId: 'coa-karin',
      description: 'Leaders share experiences from the term and give each other structured feedback.',
      participantIds: allLeaderIds, attendedIds: [], status: 'scheduled', remindersSent: 0,
    },
  ];

  // ---- surveys ----
  const devQuestions = [
    { id: 'q1', type: 'rating' as const, text: 'How confident are you in facilitating group discussions?' },
    { id: 'q2', type: 'text' as const, text: 'What challenges have you experienced this month?' },
    { id: 'q3', type: 'choice' as const, text: 'Which topics would you like to discuss in EDU2?', options: ['Handling silent groups', 'Questioning techniques', 'Exam preparation sessions', 'Digital tools in SI'] },
    { id: 'q4', type: 'rating' as const, text: 'How useful was your latest coaching feedback?' },
  ];
  const challenges = [
    'Low attendance in weeks with lab deadlines.', 'Some students expect me to lecture instead of facilitating.',
    'Hard to engage the quieter students.', 'Booking rooms at short notice.', 'Balancing my own studies with planning time.',
    'Groups with very different levels of prior knowledge.',
  ];
  const responders = allLeaderIds.filter((id) => id !== 'ldr-omar' && id !== 'ldr-sofia');
  const surveys: Survey[] = [{
    id: 'srv-dev', title: 'SI Leader Development Survey', coachId: 'coa-robin', targetGroup: 'all_leaders', questions: devQuestions,
    status: 'sent', createdAt: iso(subDays(now, 12)), sentAt: iso(subDays(now, 10)), recipientIds: allLeaderIds,
    responses: responders.map((id, i) => ({
      id: `resp-${i}`, respondentId: id, submittedAt: iso(subDays(now, 9 - i)),
      answers: { q1: [4, 3, 5, 4, 3, 4][i], q2: challenges[i], q3: devQuestions[2].options![[0, 2, 0, 1, 2, 2][i]], q4: [5, 4, 4, 5, 3, 4][i] },
    })),
  }];

  // ---- manual work activities ----
  const workActivities: WorkActivity[] = [
    { id: 'wa-1', userId: 'coa-robin', date: format(subDays(today, 6), 'yyyy-MM-dd'), category: 'Meeting', hours: 1.5, description: 'Coaching meeting with Alex Nilsson' },
    { id: 'wa-2', userId: 'coa-robin', date: format(subMonths(today, 1), 'yyyy-MM-dd'), category: 'Meeting', hours: 2, description: 'Coach team meeting with SI supervisor' },
    { id: 'wa-3', userId: 'coa-karin', date: format(subMonths(today, 1), 'yyyy-MM-dd'), category: 'Meeting', hours: 2, description: 'Coach team meeting with SI supervisor' },
    { id: 'wa-4', userId: 'coa-daniel', date: format(subMonths(today, 1), 'yyyy-MM-dd'), category: 'Meeting', hours: 2, description: 'Coach team meeting with SI supervisor' },
    { id: 'wa-5', userId: 'ldr-alex', date: format(subDays(today, 3), 'yyyy-MM-dd'), category: 'Meeting', hours: 1, description: 'Meeting with course lecturer about upcoming exam' },
  ];

  const db: DB = {
    version: DB_VERSION, seededAt: iso(now), users, courses, courseAssignments, coachAssignments, enrollments, sessions, attendance,
    topics, timeSlots, timePrefs, observations,
    eduCategories: [
      { id: 'EDU1', name: 'EDU1', description: 'Introductory SI leader training (configurable category)' },
      { id: 'EDU2', name: 'EDU2', description: 'Continued development workshops (configurable category)' },
    ],
    eduActivities, surveys, workActivities, reports: [], notifications: [], readNotificationIds: [], exportConfigs: {}, calendarConnections: [], feedback: [], substituteRequests: [], semesterArchive: [], grades: [], evaluations: [], evaluationTemplate: EVALUATION_TEMPLATE,
    settings: { prepHoursPerSession: 1, observationHours: 2, eduPrepHours: 1, surveyHours: 1 },
  };

  // ---- monthly reports for the two previous months ----
  const m2 = monthKey(subMonths(today, 2));
  const m1 = monthKey(subMonths(today, 1));
  const m0 = monthKey(today);
  const reports: MonthlyReport[] = [];
  const decide = (rep: MonthlyReport, status: MonthlyReport['status'], comment?: string) => {
    const sub = addDays(parseISO(rep.month + '-01'), 32);
    const subAt = iso(setHours(startOfDay(sub < now ? sub : subDays(now, 1)), 9));
    rep.status = status;
    rep.notes = 'All planned sessions were delivered. Attendance was stable.';
    rep.reflections = 'Students respond well to group problem solving. I want to work more on including quieter students.';
    if (status !== 'draft') {
      rep.submittedAt = subAt;
      rep.history.push({ at: subAt, byId: rep.ownerId, action: 'submitted' });
    }
    if (status === 'approved' || status === 'returned') {
      rep.decidedAt = iso(addDays(new Date(subAt), 2));
      rep.decidedById = 'sup-sara';
      rep.supervisorComment = comment;
      rep.history.push({ at: rep.decidedAt, byId: 'sup-sara', action: status, comment });
    }
  };
  const owners = [...allLeaderIds, ...coaches.map(([id]) => id)];
  owners.forEach((id) => {
    const a = buildReport(db, id, m2, setHours(addDays(parseISO(m2 + '-01'), 31), 8));
    decide(a, 'approved');
    reports.push(a);
    const b = buildReport(db, id, m1, setHours(addDays(parseISO(m1 + '-01'), 31), 8));
    const st = id === 'ldr-omar' || id === 'ldr-sofia' || id === 'coa-karin' ? 'submitted' : id === 'ldr-johan' ? 'returned' : 'approved';
    decide(b, st, st === 'returned' ? 'Please add a short note on the session that ran 15 minutes over and resubmit.' : undefined);
    reports.push(b);
  });
  const linaDraft = buildReport(db, 'ldr-lina', m0, subDays(now, 1));
  linaDraft.notes = 'Draft — will complete at month end.';
  reports.push(linaDraft);
  db.reports = reports;

  // ---- stored event notifications ----
  const notifications: AppNotification[] = [
    {
      id: 'evt-extra-pf', recipientIds: enrollments.filter((e) => e.courseId === 'c-pf').map((e) => e.studentId),
      title: 'New SI session added', body: `New SI session added for Programming Fundamentals on ${format(extraStart, 'EEEE d MMM, HH:mm')}.`,
      createdAt: iso(subDays(now, 1)), link: '/student/sessions', kind: 'info',
    },
    {
      id: 'evt-topic-planned', recipientIds: topics[2].voterIds,
      title: 'Topic planned', body: '“Complex numbers in polar form” has been planned for an upcoming Mathematics 1 session.',
      createdAt: iso(subDays(now, 3)), link: '/student/topics', kind: 'success',
    },
  ];
  reports.filter((rp) => rp.month === m1 && (rp.status === 'approved' || rp.status === 'returned')).forEach((rp) =>
    notifications.push({
      id: `evt-rep-${rp.id}`, recipientIds: [rp.ownerId],
      title: rp.status === 'approved' ? 'Report approved' : 'Report returned for correction',
      body: rp.status === 'approved'
        ? `Your ${format(parseISO(rp.month + '-01'), 'MMMM')} monthly report was approved by Sara Lindholm.`
        : `Your ${format(parseISO(rp.month + '-01'), 'MMMM')} report needs correction: ${rp.supervisorComment}`,
      createdAt: rp.decidedAt!, link: rp.role === 'leader' ? '/leader/reports' : '/coach/reports', kind: rp.status === 'approved' ? 'success' : 'warning',
    }),
  );
  db.notifications = notifications;

  // ---- session feedback from students (anonymous to leaders) ----
  const comments = ['Really helpful before the lab.', 'Good pace, more practice problems please.', 'Group work helped me understand.',
    'A bit crowded today.', 'Loved the exam questions.', 'Clear explanations from other students.', 'Could start a bit later in the day.', ''];
  attendance.forEach((a) => {
    const s = sessions.find((x) => x.id === a.sessionId)!;
    if (sessionEnd(s) < subDays(now, 21) && r() < 0.5) return; // fewer responses for older sessions
    (a.studentIds ?? []).forEach((sid) => {
      if (sid === 'stu-emma' || r() > 0.35) return;
      const base = s.courseId === 'c-fy' ? 3.6 : s.courseId === 'c-ma' ? 4.3 : 4.0;
      const rating = Math.max(1, Math.min(5, Math.round(base + (r() - 0.5) * 2.2)));
      db.feedback.push({
        id: `fb-${a.sessionId}-${sid}`, sessionId: a.sessionId, studentId: sid, rating,
        helpful: rating >= 4 ? 'yes' : rating === 3 ? 'partly' : 'no', comment: comments[Math.floor(r() * comments.length)],
        createdAt: iso(addMinutes(sessionEnd(s), 60 + Math.round(r() * 1440))),
      });
    });
  });

  // ---- plans and materials for upcoming sessions ----
  const upcomingAlex = sessions.filter((s) => s.leaderId === 'ldr-alex' && !past(s) && !s.cancelled);
  const tpl = PLAN_TEMPLATES[0];
  if (upcomingAlex[0]) {
    upcomingAlex[0].plan = {
      templateId: tpl.id, goals: tpl.goals, notes: 'Bring the old exam from 2025.', updatedAt: iso(subDays(now, 1)),
      activities: tpl.activities.map((a, i) => ({ ...a, id: `pa-${i}` })),
    };
    const txt = `SI exercise sheet — ${upcomingAlex[0].topic}\n\n1. Warm-up problem\n2. Group problems A–D\n3. Exit question\n\n(Fictional demo material)`;
    upcomingAlex[0].materials = [{
      id: 'mat-1', name: 'Exercise sheet.txt', size: txt.length, mime: 'text/plain', uploadedAt: iso(subDays(now, 1)),
      dataUrl: 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt),
    }];
  }

  // ---- open substitute request (Elin asks for cover next week) ----
  const elinNext = sessions.find((s) => s.leaderId === 'ldr-elin' && !past(s) && !s.cancelled && sessionEnd(s) > addDays(now, 3));
  if (elinNext) {
    db.substituteRequests.push({ id: 'sub-1', sessionId: elinNext.id, requesterId: 'ldr-elin', reason: 'I have a lab exam at the same time.', status: 'open', createdAt: iso(subDays(now, 1)) });
  }

  // ---- finished course (Physics): self-reported grades and SI evaluations ----
  const attendedIn = (sid: string, cid: string) =>
    attendance.filter((a) => a.studentIds?.includes(sid) && sessions.find((s) => s.id === a.sessionId)?.courseId === cid).length;
  const fyStudents = enrollments.filter((e) => e.courseId === 'c-fy').map((e) => e.studentId);
  fyStudents.forEach((sid) => {
    if (sid === 'stu-emma' || r() < 0.2) return; // Emma and ~20% have not reported yet → weekly reminders
    const a = attendedIn(sid, 'c-fy');
    const z = (r() + r() + r()) / 3 + 0.022 * a;
    const grade = z < 0.42 ? 'U' : z < 0.6 ? '3' : z < 0.76 ? '4' : '5';
    db.grades.push({ id: `gr-${sid}-fy`, courseId: 'c-fy', studentId: sid, grade, consent: true, reportedAt: iso(addDays(physicsEnd, 2 + Math.floor(r() * 2))) });
  });
  const evalTexts = {
    well: ['Explained things in a way that made sense.', 'Always made sure everyone got to speak.', 'Great old exam practice.', 'Patient and well prepared.', 'Made the group feel safe to ask "stupid" questions.'],
    improve: ['Sometimes a bit too fast at the end.', 'More time for exam problems.', 'Room was often too small.', 'Could start with a recap of the lecture.', ''],
  };
  fyStudents.forEach((sid) => {
    if (sid === 'stu-emma' || attendedIn(sid, 'c-fy') === 0 || r() < 0.25) return;
    const byLeader = ['ldr-omar', 'ldr-maja'].map((l) => ({ l, n: attendance.filter((a) => a.studentIds?.includes(sid) && sessions.find((s) => s.id === a.sessionId)?.leaderId === l).length }));
    const leaderId = byLeader.sort((x, y) => y.n - x.n)[0].l;
    const base = leaderId === 'ldr-maja' ? 4.4 : 3.9;
    const rate = () => Math.max(1, Math.min(5, Math.round(base + (r() - 0.5) * 1.8)));
    db.evaluations.push({
      id: `ev-${sid}-fy`, courseId: 'c-fy', studentId: sid, leaderId, createdAt: iso(addDays(physicsEnd, 1 + Math.floor(r() * 3))),
      answers: { e1: rate(), e2: rate(), e3: rate(), e4: rate(), e5: r() < 0.8 ? 'Yes' : r() < 0.6 ? 'Maybe' : 'No', e6: evalTexts.well[Math.floor(r() * 5)], e7: evalTexts.improve[Math.floor(r() * 5)] },
    });
  });

  // ---- archived previous semester (aggregated, fictional) ----
  db.semesterArchive = [
    { semester: 'VT2026', courseId: 'c-ma', sessions: 30, attendance: 342, uniqueStudents: 19, enrolled: 26, avgRating: 4.1 },
    { semester: 'VT2026', courseId: 'c-pf', sessions: 24, attendance: 238, uniqueStudents: 17, enrolled: 25, avgRating: 3.9 },
    { semester: 'VT2026', courseId: 'c-fy', sessions: 22, attendance: 205, uniqueStudents: 15, enrolled: 24, avgRating: 3.8 },
    { semester: 'VT2026', courseId: 'c-ie', sessions: 20, attendance: 150, uniqueStudents: 12, enrolled: 24, avgRating: 3.7 },
  ];
  // sanity: attendance map usage (keeps import used in some bundlers)
  void attendanceMap;
  return db;
}
