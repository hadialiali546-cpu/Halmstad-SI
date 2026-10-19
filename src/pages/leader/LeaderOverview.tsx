import { CalendarConnect } from '@/components/shared/CalendarConnect';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Users, ClipboardCheck, FileText, ArrowRight, Eye, ThumbsUp, Star, UserRoundPlus, QrCode } from 'lucide-react';
import { useState } from 'react';
import { CheckinPanel } from '@/components/shared/CheckinPanel';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';
import { useStore } from '@/data/store';
import { courseName, findReport, monthKey, sessionStatus, sessionStats, userName } from '@/data/calc';
import { useAttendance, useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, StatCard, AutomationNote, ReportStatusBadge, ObservationBadge, SessionStatusBadge, TopicBadge, EmptyState } from '@/components/ui/misc';
import { fmtDate, fmtDay, fmtTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function LeaderOverview() {
  const { db, now, actions } = useStore();
  const toast = useToast();
  const [checkinFor, setCheckinFor] = useState<string | null>(null);
  const { id, user } = useMe();
  const att = useAttendance();
  const navigate = useNavigate();
  const { t } = useT();
  const mine = db.sessions.filter((s) => s.leaderId === id);
  const month = monthKey(now);
  const monthStats = sessionStats(mine.filter((s) => monthKey(s.start) === month), att, now);
  const allStats = sessionStats(mine, att, now);
  const upcoming = mine.filter((s) => sessionStatus(s, att, now) === 'scheduled');
  const pending = mine.filter((s) => sessionStatus(s, att, now) === 'attendance_pending');
  const report = findReport(db, id, month);
  const myCourses = db.courseAssignments.filter((a) => a.leaderId === id).map((a) => a.courseId);
  const topics = db.topics.filter((t) => myCourses.includes(t.courseId) && t.status === 'open').sort((a, b) => b.voterIds.length - a.voterIds.length);
  const obs = db.observations.filter((o) => o.leaderId === id).sort((a, b) => a.number - b.number);
  const mySessionIds = new Set(mine.map((s) => s.id));
  const fb = db.feedback.filter((f) => mySessionIds.has(f.sessionId));
  const avgRating = fb.length ? (fb.reduce((n, f) => n + f.rating, 0) / fb.length).toFixed(1) : '—';
  const recentComments = [...fb].filter((f) => f.comment).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const subReqs = db.substituteRequests.filter((r) => {
    const s = db.sessions.find((x) => x.id === r.sessionId);
    return r.status === 'open' && r.requesterId !== id && s && myCourses.includes(s.courseId);
  });
  const myReqs = db.substituteRequests.filter((r) => r.status === 'open' && r.requesterId === id);

  return (
    <div className="space-y-6">
      <CheckinPanel sessionId={checkinFor} onClose={() => setCheckinFor(null)} />
      <PageHeader
        title={`Welcome back, ${user.name.split(' ')[0]}`}
        description={`SI leader for ${myCourses.map((c) => courseName(db, c)).join(', ')}`}
        actions={<Button variant="teal" onClick={() => navigate('/leader/reports')}><FileText />{t('Generate Monthly Report')}</Button>}
      />
      <CalendarConnect variant="banner" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={CalendarDays} label="Upcoming sessions" value={upcoming.length} onClick={() => navigate('/leader/sessions')} />
        <StatCard icon={CheckCircle2} label={`Completed in ${format(now, 'MMMM')}`} value={monthStats.completed} tone="success" hint={`${monthStats.hours} session hours`} />
        <StatCard icon={Users} label={`Attendance in ${format(now, 'MMMM')}`} value={monthStats.attendance} tone="teal" hint={`${allStats.attendance} this semester · instances`} />
        <StatCard icon={ClipboardCheck} label="Pending attendance" value={pending.length} tone={pending.length ? 'warning' : 'success'} onClick={() => navigate('/leader/attendance')} />
        <StatCard icon={FileText} label="Monthly report" value={<span className="text-base"><ReportStatusBadge status={report?.status ?? 'none'} /></span>} hint={format(now, 'MMMM yyyy')} onClick={() => navigate('/leader/reports')} />
      </div>

      {pending.length ? (
        <Card className="border-warning/40">
          <CardHeader><CardTitle>Action required: register attendance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-bg/60 px-3 py-2.5">
                <div className="text-sm"><span className="font-medium text-navy">{courseName(db, s.courseId)}</span> <span className="text-muted">· {fmtDay(s.start)}, {fmtTime(s.start)} · {s.topic}</span></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCheckinFor(s.id)}><QrCode />QR check-in</Button>
                  <Button size="sm" onClick={() => navigate(`/leader/attendance?session=${s.id}`)}>Register attendance</Button>
                </div>
              </div>
            ))}
            <AutomationNote className="mt-2">Attendance automatically updates course statistics and monthly reports.</AutomationNote>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Upcoming sessions</CardTitle><Link to="/leader/sessions" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">Manage <ArrowRight className="size-4" /></Link></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.slice(0, 5).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="w-24 shrink-0 text-sm"><p className="font-medium text-navy">{fmtDay(s.start)}</p><p className="text-muted">{fmtTime(s.start)}</p></div>
                <div className="min-w-0 flex-1 text-sm"><p className="font-medium text-slate-800">{s.topic}</p><p className="text-muted">{courseName(db, s.courseId)} · {s.location}</p></div>
                <SessionStatusBadge status="scheduled" />
              </div>
            ))}
            {!upcoming.length ? <EmptyState title="No upcoming sessions" /> : null}
          </CardContent>
        </Card>
        <div className="space-y-6">
          {subReqs.length || myReqs.length ? (
            <Card className="border-warning/40">
              <CardHeader><CardTitle className="flex items-center gap-2"><UserRoundPlus className="size-4 text-warning" />Substitute requests</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {subReqs.map((r) => {
                  const s = db.sessions.find((x) => x.id === r.sessionId)!;
                  return (
                    <div key={r.id} className="rounded-lg bg-warning-bg/50 p-3 text-sm">
                      <p className="font-medium text-navy">{userName(db, r.requesterId)} needs cover</p>
                      <p className="text-muted">{courseName(db, s.courseId)} · {fmtDay(s.start)}, {fmtTime(s.start)}</p>
                      <p className="mt-1 text-slate-600">“{r.reason}”</p>
                      <Button size="sm" className="mt-2" onClick={() => { actions.resolveSubstitute(r.id, 'accept', id); toast({ title: 'You accepted the session', body: 'It is now in your schedule and monthly report.' }); }}>Accept — I’ll lead it</Button>
                    </div>
                  );
                })}
                {myReqs.map((r) => {
                  const s = db.sessions.find((x) => x.id === r.sessionId);
                  return s ? (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <span>Your request for {fmtDay(s.start)} — waiting</span>
                      <Button size="sm" variant="ghost" onClick={() => actions.resolveSubstitute(r.id, 'withdraw', id)}>Withdraw</Button>
                    </div>
                  ) : null;
                })}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Star className="size-4 text-muted" />Student feedback</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-3">
                <p className="text-3xl font-semibold tabular-nums text-navy">{avgRating}</p>
                <p className="pb-1 text-sm text-muted">average of {fb.length} anonymous ratings (1–5)</p>
              </div>
              {recentComments.map((c) => <p key={c.id} className="rounded-lg bg-canvas px-3 py-2 text-sm text-slate-700">“{c.comment}” <span className="text-xs text-muted">· {c.rating}/5</span></p>)}
              <p className="text-xs text-muted">Feedback is shown without student names.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="size-4 text-muted" />My coaching record</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted">Coach: {userName(db, db.coachAssignments.find((a) => a.leaderId === id)?.coachId ?? '')}</p>
              {obs.map((o) => (
                <div key={o.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-navy">Observation {o.number}</p>
                    <ObservationBadge status={o.status} />
                  </div>
                  {o.date ? <p className="text-xs text-muted">{fmtDate(o.date)}</p> : null}
                  {o.status === 'completed' ? <p className="mt-1.5 text-sm text-slate-600"><span className="font-medium">Recommendation:</span> {o.recommendations || '—'}</p> : null}
                </div>
              ))}
              <p className="text-xs text-muted">Observations support development; completion does not by itself indicate performance quality.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top student requests</CardTitle><Link to="/leader/requests" className="text-sm font-medium text-teal hover:underline">All</Link></CardHeader>
            <CardContent className="space-y-2">
              {topics.slice(0, 4).map((tp) => (
                <div key={tp.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-slate-800">{tp.text}</span>
                  <span className="flex shrink-0 items-center gap-2 text-muted"><ThumbsUp className="size-3.5" />{tp.voterIds.length}<TopicBadge status={tp.status} /></span>
                </div>
              ))}
              {!topics.length ? <p className="text-sm text-muted">No open requests.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
