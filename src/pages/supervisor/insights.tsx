// Deeper analytics: reach & retention, course health, semester comparison, management PDF.
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, parseISO, startOfWeek, subWeeks } from 'date-fns';
import { useStore } from '@/data/store';
import {
  attendanceMap, avgRating, courseName, leadersOfCourse, monthLabel, observationCompletion, round1, semesterLabel, semesterOf,
  sessionStatus, sessionStats, studentsOfCourse, uniqueStudents, userName,
} from '@/data/calc';
import type { DB, SISession } from '@/data/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard, AutomationNote } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { exportPDF } from '@/lib/files';
import { cn } from '@/lib/utils';
import { colorFor } from './analytics';

// ---------- calculations ----------
export function reachStats(db: DB, sessions: SISession[], now: Date) {
  const att = attendanceMap(db);
  const done = sessions.filter((s) => sessionStatus(s, att, now) === 'completed');
  const courseIds = Array.from(new Set(sessions.map((s) => s.courseId)));
  const enrolled = new Set(courseIds.flatMap((c) => studentsOfCourse(db, c)));
  const perStudent = new Map<string, number>();
  done.forEach((s) => att.get(s.id)?.studentIds?.forEach((id) => perStudent.set(id, (perStudent.get(id) ?? 0) + 1)));
  const reached = perStudent.size;
  const repeat = [...perStudent.values()].filter((n) => n >= 3).length;
  const buckets = [
    { label: 'Never', n: [...enrolled].filter((id) => !perStudent.has(id)).length },
    { label: '1', n: [...perStudent.values()].filter((n) => n === 1).length },
    { label: '2–3', n: [...perStudent.values()].filter((n) => n >= 2 && n <= 3).length },
    { label: '4–6', n: [...perStudent.values()].filter((n) => n >= 4 && n <= 6).length },
    { label: '7+', n: [...perStudent.values()].filter((n) => n >= 7).length },
  ];
  // weekly first-time vs returning attendees
  const seen = new Set<string>();
  const weeks = new Map<string, { label: string; firstTime: number; returning: number }>();
  [...done].sort((a, b) => a.start.localeCompare(b.start)).forEach((s) => {
    const wk = format(startOfWeek(parseISO(s.start), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const w = weeks.get(wk) ?? { label: format(parseISO(wk), 'd MMM'), firstTime: 0, returning: 0 };
    att.get(s.id)?.studentIds?.forEach((id) => { if (seen.has(id)) w.returning++; else { seen.add(id); w.firstTime++; } });
    weeks.set(wk, w);
  });
  const byCourse = courseIds.map((c) => {
    const cs = done.filter((s) => s.courseId === c);
    const en = studentsOfCourse(db, c).length;
    const u = uniqueStudents(cs, att);
    return { id: c, name: courseName(db, c), reach: en ? Math.round((u / en) * 100) : 0, unique: u, enrolled: en };
  });
  return {
    enrolled: enrolled.size, reached, reachPct: enrolled.size ? Math.round((reached / enrolled.size) * 100) : 0,
    repeat, repeatPct: reached ? Math.round((repeat / reached) * 100) : 0,
    avgPerStudent: reached ? round1([...perStudent.values()].reduce((a, b) => a + b, 0) / reached) : 0,
    buckets, weekly: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v), byCourse,
  };
}

type Level = 'ok' | 'watch' | 'risk';
export interface CourseHealth { courseId: string; name: string; level: Level; reasons: string[]; trendPct: number | null; reach: number; rating: number; ratingN: number; pending: number; obsOpen: number }

export function courseHealth(db: DB, now: Date): CourseHealth[] {
  const att = attendanceMap(db);
  const sem = semesterOf(now);
  return db.courses.map((c) => {
    const ss = db.sessions.filter((s) => s.courseId === c.id && semesterOf(s.start) === sem);
    const done = ss.filter((s) => sessionStatus(s, att, now) === 'completed');
    const avgIn = (from: Date, to: Date) => {
      const w = done.filter((s) => parseISO(s.start) >= from && parseISO(s.start) < to);
      return w.length ? w.reduce((n, s) => n + att.get(s.id)!.count, 0) / w.length : null;
    };
    const recent = avgIn(subWeeks(now, 3), now);
    const prev = avgIn(subWeeks(now, 6), subWeeks(now, 3));
    const trendPct = recent !== null && prev ? Math.round(((recent - prev) / prev) * 100) : null;
    const en = studentsOfCourse(db, c.id).length;
    const reach = en ? Math.round((uniqueStudents(done, att) / en) * 100) : 0;
    const r = avgRating(db, new Set(ss.map((s) => s.id)));
    const pending = ss.filter((s) => sessionStatus(s, att, now) === 'attendance_pending').length;
    const leaders = leadersOfCourse(db, c.id);
    const obsOpen = db.observations.filter((o) => leaders.includes(o.leaderId) && o.status === 'not_scheduled').length;
    const reasons: string[] = [];
    let level: Level = 'ok';
    const rank: Record<Level, number> = { ok: 0, watch: 1, risk: 2 };
    const flag = (l: Level, why: string) => { reasons.push(why); if (rank[l] > rank[level]) level = l; };
    if (trendPct !== null && trendPct <= -35) flag('risk', `Attendance down ${-trendPct}% (last 3 weeks)`);
    else if (trendPct !== null && trendPct <= -20) flag('watch', `Attendance down ${-trendPct}% (last 3 weeks)`);
    if (!leaders.length) flag('risk', 'No SI leader assigned');
    if (reach < 35) flag('risk', `Only ${reach}% of students reached`);
    else if (reach < 50) flag('watch', `${reach}% of students reached`);
    if (r.n >= 5 && r.avg < 3.3) flag('risk', `Low student rating (${r.avg})`);
    else if (r.n >= 5 && r.avg < 3.8) flag('watch', `Student rating ${r.avg}`);
    if (pending >= 2) flag('watch', `${pending} sessions missing attendance`);
    if (obsOpen) flag('watch', `${obsOpen} observation(s) not scheduled`);
    return { courseId: c.id, name: c.name, level, reasons, trendPct, reach, rating: r.avg, ratingN: r.n, pending, obsOpen };
  });
}

export function semesterComparison(db: DB, now: Date) {
  const att = attendanceMap(db);
  const sem = semesterOf(now);
  const prevSem = db.semesterArchive[0]?.semester ?? '';
  return {
    sem, prevSem,
    rows: db.courses.map((c) => {
      const ss = db.sessions.filter((s) => s.courseId === c.id && semesterOf(s.start) === sem);
      const st = sessionStats(ss, att, now);
      const done = ss.filter((s) => sessionStatus(s, att, now) === 'completed');
      const en = studentsOfCourse(db, c.id).length;
      const u = uniqueStudents(done, att);
      const prev = db.semesterArchive.find((a) => a.courseId === c.id && a.semester === prevSem);
      return {
        id: c.id, name: c.name,
        cur: { sessions: st.completed, attendance: st.attendance, avg: st.avg, reach: en ? Math.round((u / en) * 100) : 0, rating: avgRating(db, new Set(ss.map((s) => s.id))).avg },
        prev: prev ? { sessions: prev.sessions, attendance: prev.attendance, avg: round1(prev.attendance / prev.sessions), reach: Math.round((prev.uniqueStudents / prev.enrolled) * 100), rating: prev.avgRating } : null,
      };
    }),
  };
}

// ---------- UI ----------
const Delta = ({ cur, prev, suffix = '' }: { cur: number; prev?: number; suffix?: string }) => {
  if (prev === undefined) return <span>{cur}{suffix}</span>;
  const d = round1(cur - prev);
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-medium tabular-nums text-navy">{cur}{suffix}</span>
      <span className={cn('inline-flex items-center text-xs tabular-nums', d > 0 ? 'text-success' : d < 0 ? 'text-danger' : 'text-muted')}><Icon className="size-3.5" />{d > 0 ? '+' : ''}{d}{suffix}</span>
    </span>
  );
};

export function ReachTab({ sessions }: { sessions: SISession[] }) {
  const { db, now } = useStore();
  const r = useMemo(() => reachStats(db, sessions, now), [db, sessions, now]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Students on course lists" value={r.enrolled} />
        <StatCard label="Unique students reached" value={r.reached} tone="teal" hint={`${r.reachPct}% reach`} />
        <StatCard label="Repeat attenders (3+)" value={r.repeat} tone="success" hint={`${r.repeatPct}% of reached`} />
        <StatCard label="Sessions per reached student" value={r.avgPerStudent} />
        <StatCard label="Never attended" value={r.buckets[0].n} tone="warning" hint="possible outreach group" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-col"><CardTitle>Students by number of sessions attended</CardTitle><CardDescription>Named attendance only</CardDescription></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer>
            <BarChart data={r.buckets} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v) => [v, 'Students']} labelFormatter={(l) => `${l} session(s)`} />
              <Bar dataKey="n" fill="#12304A" radius={[4, 4, 0, 0]} barSize={44} />
            </BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-col"><CardTitle>First-time vs returning attendees</CardTitle><CardDescription>Per week — returning students show that SI keeps its participants</CardDescription></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer>
            <BarChart data={r.weekly} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} /><YAxis tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} /><Legend />
              <Bar dataKey="returning" name="Returning" stackId="a" fill="#008D95" />
              <Bar dataKey="firstTime" name="First time" stackId="a" fill="#E0A23B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex-col"><CardTitle>Reach by course</CardTitle><CardDescription>Share of students on the course list who attended at least once</CardDescription></CardHeader>
          <CardContent><div className="h-56"><ResponsiveContainer>
            <BarChart data={r.byCourse} layout="vertical" margin={{ left: 20, right: 30 }}><CartesianGrid horizontal={false} stroke="#E3E8EE" /><XAxis type="number" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v, _n, p) => [`${v}% (${p.payload.unique}/${p.payload.enrolled})`, 'Reach']} />
              <Bar dataKey="reach" fill="#008D95" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
      </div>
      <AutomationNote>Possible because SI leaders register attendance by name: the platform separates unique students from attendance instances.</AutomationNote>
    </div>
  );
}

export function HealthTab() {
  const { db, now } = useStore();
  const rows = useMemo(() => courseHealth(db, now), [db, now]);
  const tone = { ok: 'bg-success-bg text-success', watch: 'bg-warning-bg text-warning', risk: 'bg-danger-bg text-danger' } as const;
  const label = { ok: 'On track', watch: 'Watch', risk: 'Needs attention' } as const;
  const Icon = { ok: CheckCircle2, watch: AlertTriangle, risk: ShieldAlert } as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        {rows.map((r) => {
          const I = Icon[r.level];
          return (
            <div key={r.courseId} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-navy">{r.name}</p>
                <span className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', tone[r.level])}><I className="size-3.5" />{label[r.level]}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {r.reasons.length ? r.reasons.map((x) => <li key={x}>• {x}</li>) : <li>No warning signs.</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <Card>
        <Table>
          <THead><TR><TH>Course</TH><TH className="text-right">Attendance trend</TH><TH className="text-right">Reach</TH><TH className="text-right">Rating</TH><TH className="text-right">Missing attendance</TH><TH className="text-right">Obs. not scheduled</TH><TH>Status</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.courseId}>
                <TD className="font-medium text-navy">{r.name}</TD>
                <TD className="text-right tabular-nums">{r.trendPct === null ? '—' : <span className={r.trendPct < -20 ? 'text-danger' : r.trendPct > 0 ? 'text-success' : ''}>{r.trendPct > 0 ? '+' : ''}{r.trendPct}%</span>}</TD>
                <TD className="text-right tabular-nums">{r.reach}%</TD>
                <TD className="text-right tabular-nums">{r.ratingN ? `${r.rating} (${r.ratingN})` : '—'}</TD>
                <TD className="text-right tabular-nums">{r.pending}</TD>
                <TD className="text-right tabular-nums">{r.obsOpen}</TD>
                <TD><span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone[r.level])}>{label[r.level]}</span></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <p className="text-xs text-muted">Rules: attendance down 20%/35% (last 3 weeks vs the 3 before), reach under 50%/35%, rating under 3.8/3.3, 2+ missing registrations, unscheduled observations. Indicators are prompts for follow-up — not judgements of individual SI leaders.</p>
    </div>
  );
}

export function CompareTab() {
  const { db, now } = useStore();
  const c = useMemo(() => semesterComparison(db, now), [db, now]);
  const chart = c.rows.map((r) => ({ name: r.name.replace('Introduction to', 'Intro.').replace('Fundamentals', 'Fund.'), [c.sem]: r.cur.avg, [c.prevSem]: r.prev?.avg ?? 0 }));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-col"><CardTitle>Average attendance per session</CardTitle><CardDescription>{semesterLabel(c.sem)} (in progress) vs {c.prevSem ? semesterLabel(c.prevSem) : '—'} (archived)</CardDescription></CardHeader>
        <CardContent><div className="h-64"><ResponsiveContainer>
          <BarChart data={chart} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} /><YAxis tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} /><Legend />
            <Bar dataKey={c.prevSem} fill="#AFC4DA" radius={[4, 4, 0, 0]} barSize={28} />
            <Bar dataKey={c.sem} fill="#12304A" radius={[4, 4, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer></div></CardContent>
      </Card>
      <Card>
        <Table>
          <THead><TR><TH>Course</TH><TH className="text-right">Sessions</TH><TH className="text-right">Attendance</TH><TH>Avg / session</TH><TH>Reach</TH><TH>Rating</TH></TR></THead>
          <TBody>
            {c.rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-navy">{r.name}</TD>
                <TD className="text-right tabular-nums">{r.cur.sessions} <span className="text-xs text-muted">/ {r.prev?.sessions ?? '—'}</span></TD>
                <TD className="text-right tabular-nums">{r.cur.attendance} <span className="text-xs text-muted">/ {r.prev?.attendance ?? '—'}</span></TD>
                <TD><Delta cur={r.cur.avg} prev={r.prev?.avg} /></TD>
                <TD><Delta cur={r.cur.reach} prev={r.prev?.reach} suffix="%" /></TD>
                <TD>{r.cur.rating ? <Delta cur={r.cur.rating} prev={r.prev?.rating} /> : '—'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <p className="text-xs text-muted">Session and attendance totals show “this semester so far / previous full semester”. Averages, reach and ratings are compared directly. Archived semester totals are fictional and contain no personal data.</p>
    </div>
  );
}

export function exportManagementSummary(db: DB, now: Date) {
  const att = attendanceMap(db);
  const sem = semesterOf(now);
  const ss = db.sessions.filter((s) => semesterOf(s.start) === sem);
  const st = sessionStats(ss, att, now);
  const reach = reachStats(db, ss, now);
  const obs = observationCompletion(db);
  const rating = avgRating(db, new Set(ss.map((s) => s.id)));
  const health = courseHealth(db, now);
  const cmp = semesterComparison(db, now);
  const comments = db.feedback.filter((f) => f.comment && f.rating >= 4).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const pending = db.reports.filter((r) => r.status === 'submitted').length;
  exportPDF(
    `SI programme summary — ${semesterLabel(sem)}`,
    `Prepared ${format(now, 'd MMMM yyyy')} for programme management · fictional demo data`,
    [
      { heading: 'Key figures', table: { head: ['Measure', 'Value'], body: [
        ['Sessions delivered', st.completed], ['Session hours', st.hours], ['Attendance instances', st.attendance], ['Unique students reached', `${reach.reached} of ${reach.enrolled} (${reach.reachPct}%)`],
        ['Repeat attenders (3+ sessions)', `${reach.repeat} (${reach.repeatPct}%)`], ['Average student rating', rating.n ? `${rating.avg} / 5 (${rating.n} ratings)` : '—'],
        ['Observation completion', `${obs.done}/${obs.total} (${obs.rate}%)`], ['Reports awaiting approval', pending],
      ] } },
      { heading: 'Courses', table: { head: ['Course', 'Leaders', 'Sessions', 'Attendance', 'Avg', 'Reach', 'Rating', 'Status'], body: health.map((h) => {
        const r = cmp.rows.find((x) => x.id === h.courseId)!;
        return [h.name, leadersOfCourse(db, h.courseId).map((l) => userName(db, l)).join(', '), r.cur.sessions, r.cur.attendance, r.cur.avg, `${h.reach}%`, h.ratingN ? h.rating : '—', h.level === 'ok' ? 'On track' : h.level === 'watch' ? 'Watch' : 'Needs attention'];
      }) } },
      { heading: 'Follow-up points', text: health.flatMap((h) => h.reasons.map((r) => `• ${h.name}: ${r}`)).join('\n') || 'No warning signs.' },
      { heading: `Compared with ${cmp.prevSem}`, table: { head: ['Course', `Avg/session ${cmp.prevSem}`, `Avg/session ${cmp.sem}`, `Reach ${cmp.prevSem}`, `Reach ${cmp.sem}`], body: cmp.rows.map((r) => [r.name, r.prev?.avg ?? '—', r.cur.avg, r.prev ? `${r.prev.reach}%` : '—', `${r.cur.reach}%`]) } },
      { heading: 'What students say (anonymous)', text: comments.map((c) => `“${c.comment}” (${courseName(db, db.sessions.find((s) => s.id === c.sessionId)?.courseId ?? '')})`).join('\n') || '—' },
      { heading: 'About the data', text: `All figures are calculated from registered sessions, named attendance and anonymous feedback in Halmstad SI. Attendance instances count every visit; unique students count each person once. Reporting month: ${monthLabel(format(now, 'yyyy-MM'))}.` },
    ],
    `SI-management-summary-${sem}-${format(now, 'yyyyMMdd')}.pdf`,
  );
}
export { colorFor };
