import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Presentation, Compass, CalendarCheck, Users, FileClock, Eye, ArrowRight, AlertTriangle } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { subMonths } from 'date-fns';
import { useStore } from '@/data/store';
import { uniqueStudents, attendanceMap, monthKey, monthLabel, observationCompletion, semesterLabel, semesterOf, sessionStatus, sessionStats, userName } from '@/data/calc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, StatCard, AutomationNote, ReportStatusBadge } from '@/components/ui/misc';
import { attendanceOverTime, colorFor, perCourse, reportingStatus, REPORT_COLORS } from './analytics';
import { fmtDate } from '@/lib/utils';

export function SupOverview() {
  const { db, now } = useStore();
  const navigate = useNavigate();
  const att = useMemo(() => attendanceMap(db), [db]);
  const sem = semesterOf(now);
  const semSessions = db.sessions.filter((s) => semesterOf(s.start) === sem);
  const st = sessionStats(semSessions, att, now);
  const activeCourses = db.courses.filter((c) => db.courseAssignments.some((a) => a.courseId === c.id));
  const activeLeaders = new Set(db.courseAssignments.map((a) => a.leaderId));
  const activeCoaches = new Set(db.coachAssignments.map((a) => a.coachId));
  const pending = db.reports.filter((r) => r.status === 'submitted');
  const obs = observationCompletion(db);
  const trend = attendanceOverTime(db, semSessions, now);
  const courses = perCourse(db, semSessions, now);
  const rep = reportingStatus(db, [2, 1, 0].map((i) => monthKey(subMonths(now, i))));
  const missing = db.sessions.filter((s) => sessionStatus(s, att, now) === 'attendance_pending');
  const missingByLeader = Object.entries(missing.reduce<Record<string, number>>((m, s) => ({ ...m, [s.leaderId]: (m[s.leaderId] ?? 0) + 1 }), {}));

  return (
    <div className="space-y-6">
      <PageHeader title="SI programme overview" description={`${semesterLabel(sem)} · all figures are calculated live from registered activities.`} actions={<Button variant="outline" onClick={() => navigate('/supervisor/analytics')}>Open analytics <ArrowRight /></Button>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 2xl:grid-cols-7">
        <StatCard icon={BookOpen} label="Active SI courses" value={activeCourses.length} onClick={() => navigate('/supervisor/courses')} />
        <StatCard icon={Presentation} label="Active SI leaders" value={activeLeaders.size} tone="teal" onClick={() => navigate('/supervisor/team')} />
        <StatCard icon={Compass} label="Active SI coaches" value={activeCoaches.size} tone="teal" onClick={() => navigate('/supervisor/team')} />
        <StatCard icon={CalendarCheck} label="Sessions this semester" value={st.completed} hint={`${st.hours} session hours`} />
        <StatCard icon={Users} label="Attendance instances" value={st.attendance} hint={`${uniqueStudents(semSessions, att)} unique students · avg ${st.avg}`} tone="success" />
        <StatCard icon={FileClock} label="Pending reports" value={pending.length} tone={pending.length ? 'warning' : 'success'} onClick={() => navigate('/supervisor/reports')} />
        <StatCard icon={Eye} label="Observation completion" value={`${obs.rate}%`} hint={`${obs.done} of ${obs.total}`} onClick={() => navigate('/supervisor/analytics')} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-col"><CardTitle>Attendance over time</CardTitle><CardDescription>Weekly attendance instances by course (not unique students)</CardDescription></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid vertical={false} stroke="#E3E8EE" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  {db.courses.map((c, i) => <Area key={c.id} type="monotone" dataKey={c.id} name={c.name} stackId="1" stroke={colorFor(c.id, i)} fill={colorFor(c.id, i)} fillOpacity={0.75} animationDuration={700} />)}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-col"><CardTitle>Monthly reporting status</CardTitle><CardDescription>SI leaders and coaches</CardDescription></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={rep} margin={{ left: -20 }}>
                  <CartesianGrid vertical={false} stroke="#E3E8EE" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F1F4F8' }} />
                  <Legend />
                  {Object.entries(REPORT_COLORS).map(([k, c]) => <Bar key={k} dataKey={k} stackId="a" fill={c} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Courses</CardTitle><Link to="/supervisor/courses" className="text-sm font-medium text-teal hover:underline">Details</Link></CardHeader>
          <CardContent className="space-y-3">
            {courses.map((c, i) => (
              <button key={c.id} onClick={() => navigate(`/supervisor/courses/${c.id}`)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted-bg/60">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorFor(c.id, i) }} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-navy">{c.name}</span><span className="text-xs text-muted">{c.sessions} sessions · avg {c.avg}</span></span>
                <span className="text-sm font-semibold tabular-nums text-navy">{c.attendance}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Awaiting your approval</CardTitle><Link to="/supervisor/reports" className="text-sm font-medium text-teal hover:underline">Inbox</Link></CardHeader>
          <CardContent className="space-y-2">
            {pending.map((r) => (
              <button key={r.id} onClick={() => navigate(`/supervisor/reports?open=${r.id}`)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-muted-bg/60">
                <span><span className="block text-sm font-medium text-navy">{userName(db, r.ownerId)}</span><span className="text-xs text-muted">{monthLabel(r.month)} · {r.role === 'leader' ? 'SI leader' : 'SI coach'} · {r.submittedAt ? fmtDate(r.submittedAt) : ''}</span></span>
                <ReportStatusBadge status={r.status} />
              </button>
            ))}
            {!pending.length ? <p className="text-sm text-muted">No reports awaiting approval.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Missing attendance</CardTitle><Link to="/supervisor/team" className="text-sm font-medium text-teal hover:underline">Team</Link></CardHeader>
          <CardContent className="space-y-2">
            {missingByLeader.map(([l, n]) => (
              <div key={l} className="flex items-center justify-between rounded-lg bg-warning-bg/60 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" />{userName(db, l)}</span>
                <span className="font-medium text-warning">{n} session{n > 1 ? 's' : ''}</span>
              </div>
            ))}
            {!missingByLeader.length ? <p className="text-sm text-muted">All attendance is registered.</p> : null}
            <AutomationNote className="mt-3">These lists update instantly when SI leaders register attendance or submit reports.</AutomationNote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
