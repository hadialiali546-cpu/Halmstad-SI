import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ThumbsUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { avgRating, uniqueStudents, attendanceMap, courseById, leadersOfCourse, sessionStatus, sessionStats, studentsOfCourse, userName, coachOfLeader } from '@/data/calc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, StatCard, ObservationBadge, SessionStatusBadge, AutomationNote, TopicBadge, EmptyState } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { fmtDay, fmtTime } from '@/lib/utils';
import { prefChartData } from '@/pages/student/StudentTimes';

export function SupCourses() {
  const { db, now } = useStore();
  const navigate = useNavigate();
  const att = useMemo(() => attendanceMap(db), [db]);
  return (
    <div>
      <PageHeader title="Courses" description="SI-supported courses. Open a course for its full analytics report." />
      <Card>
        <Table>
          <THead><TR><TH>Course</TH><TH className="hidden lg:table-cell">Faculty / academy</TH><TH className="hidden md:table-cell">SI leaders</TH><TH className="text-right">Sessions</TH><TH className="text-right">Attendance</TH><TH className="text-right">Avg.</TH><TH className="hidden text-right sm:table-cell">Hours</TH><TH /></TR></THead>
          <TBody>
            {db.courses.map((c) => {
              const st = sessionStats(db.sessions.filter((s) => s.courseId === c.id), att, now);
              return (
                <TR key={c.id} className="cursor-pointer" onClick={() => navigate(`/supervisor/courses/${c.id}`)}>
                  <TD><p className="font-medium text-navy">{c.name}</p><p className="text-xs text-muted">{c.code}</p></TD>
                  <TD className="hidden lg:table-cell">{c.faculty}</TD>
                  <TD className="hidden md:table-cell">{leadersOfCourse(db, c.id).map((l) => userName(db, l)).join(', ') || '—'}</TD>
                  <TD className="text-right tabular-nums">{st.completed}</TD>
                  <TD className="text-right font-medium tabular-nums">{st.attendance}</TD>
                  <TD className="text-right tabular-nums">{st.avg}</TD>
                  <TD className="hidden text-right tabular-nums sm:table-cell">{st.hours}</TD>
                  <TD className="text-right"><ArrowRight className="ml-auto size-4 text-muted" /></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

export function SupCourseDetail() {
  const { courseId = '' } = useParams();
  const { db, now } = useStore();
  const att = useMemo(() => attendanceMap(db), [db]);
  const course = courseById(db, courseId);
  if (!course) return <EmptyState title="Course not found" action={<Link to="/supervisor/courses" className="text-teal">Back to courses</Link>} />;
  const sessions = db.sessions.filter((s) => s.courseId === course.id);
  const st = sessionStats(sessions, att, now);
  const leaders = leadersOfCourse(db, course.id);
  const trend = sessions.filter((s) => sessionStatus(s, att, now) === 'completed').map((s, i, arr) => {
    const window = arr.slice(Math.max(0, i - 3), i + 1);
    return {
      label: format(parseISO(s.start), 'd MMM'), attendance: att.get(s.id)!.count,
      rolling: Math.round((window.reduce((n, x) => n + att.get(x.id)!.count, 0) / window.length) * 10) / 10,
    };
  });
  const topics = db.topics.filter((t) => t.courseId === course.id).sort((a, b) => b.voterIds.length - a.voterIds.length);
  const prefs = prefChartData(db, course.id);
  const recent = [...sessions].filter((s) => parseISO(s.start) <= now).reverse().slice(0, 10);

  return (
    <div className="space-y-6">
      <Link to="/supervisor/courses" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline"><ArrowLeft className="size-4" />All courses</Link>
      <PageHeader title={`${course.name}`} description={`${course.code} · ${course.faculty} · ${studentsOfCourse(db, course.id).length} demo students enrolled`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Student rating" value={(() => { const r = avgRating(db, new Set(sessions.map((s) => s.id))); return r.n ? `${r.avg} / 5` : '—'; })()} hint={`${db.feedback.filter((f) => sessions.some((s) => s.id === f.sessionId)).length} anonymous ratings`} />
        <StatCard label="Sessions completed" value={st.completed} hint={`${st.scheduled} upcoming · ${st.cancelled} cancelled`} />
        <StatCard label="Attendance instances" value={st.attendance} tone="teal" />
        <StatCard label="Unique students reached" value={uniqueStudents(sessions, att)} hint={`of ${studentsOfCourse(db, course.id).length} on the course list`} tone="teal" />
        <StatCard label="Avg. attendance / session" value={st.avg} hint={`${st.hours} session hours`} />
        <StatCard label="Attendance pending" value={st.pending} tone={st.pending ? 'warning' : 'success'} />
      </div>
      <AutomationNote>Values come directly from the attendance SI leaders register — no manual consolidation. Attendance instances are not the same as unique students.</AutomationNote>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-col"><CardTitle>Attendance trend</CardTitle><CardDescription>Attendance per session with 4-session rolling average</CardDescription></CardHeader>
          <CardContent><div className="h-72"><ResponsiveContainer>
            <ComposedChart data={trend} margin={{ left: -20, right: 10 }}>
              <CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} /><YAxis tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} />
              <Bar dataKey="attendance" name="Attendance" fill="#C2E8EA" radius={[3, 3, 0, 0]} />
              <Line dataKey="rolling" name="Rolling average" stroke="#12304A" strokeWidth={2.5} dot={false} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-col"><CardTitle>SI leaders & observations</CardTitle><CardDescription>Period HT2026</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {leaders.map((l) => {
              const ls = sessionStats(sessions.filter((s) => s.leaderId === l), att, now);
              return (
                <div key={l} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-navy">{userName(db, l)}</p>
                  <p className="text-xs text-muted">Coach: {userName(db, coachOfLeader(db, l) ?? '')} · {ls.completed} sessions · {ls.attendance} attendance</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {db.observations.filter((o) => o.leaderId === l).sort((a, b) => a.number - b.number).map((o) => <span key={o.id} className="flex items-center gap-1 text-xs text-muted">Obs {o.number}<ObservationBadge status={o.status} /></span>)}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
          <Table>
            <THead><TR><TH>Date</TH><TH>SI leader</TH><TH className="hidden md:table-cell">Topic</TH><TH>Status</TH><TH className="text-right">Attendance</TH></TR></THead>
            <TBody>
              {recent.map((s) => (
                <TR key={s.id}>
                  <TD className="whitespace-nowrap">{fmtDay(s.start)}, {fmtTime(s.start)}</TD>
                  <TD>{userName(db, s.leaderId)}</TD>
                  <TD className="hidden md:table-cell">{s.topic}</TD>
                  <TD><SessionStatusBadge status={sessionStatus(s, att, now)} /></TD>
                  <TD className="text-right font-medium tabular-nums">{att.get(s.id)?.count ?? '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-col"><CardTitle>Recent student comments</CardTitle><CardDescription>Anonymous session feedback</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {db.feedback.filter((f) => f.comment && sessions.some((s) => s.id === f.sessionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).map((f) => (
                <p key={f.id} className="rounded-lg bg-canvas px-3 py-2 text-sm text-slate-700">“{f.comment}” <span className="text-xs text-muted">· {f.rating}/5</span></p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Student topic requests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {topics.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{t.text}</span><span className="flex shrink-0 items-center gap-1.5 text-muted"><ThumbsUp className="size-3.5" />{t.voterIds.length}<TopicBadge status={t.status} /></span></div>
              ))}
              {!topics.length ? <p className="text-sm text-muted">No requests.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-col"><CardTitle>Preferred times</CardTitle><CardDescription>{db.timePrefs.filter((p) => p.courseId === course.id).length} students responded</CardDescription></CardHeader>
            <CardContent><div className="h-48"><ResponsiveContainer>
              <BarChart data={prefs} layout="vertical" margin={{ left: 0, right: 10 }}><XAxis type="number" hide /><YAxis type="category" dataKey="full" width={140} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v) => [v, 'Students']} /><Bar dataKey="votes" fill="#008D95" radius={[0, 4, 4, 0]} barSize={12} /></BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
        </div>
      </div>
      <Button variant="outline" onClick={() => window.print()} className="print:hidden">Print course report</Button>
    </div>
  );
}
