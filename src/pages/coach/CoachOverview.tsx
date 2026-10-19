import { CalendarConnect } from '@/components/shared/CalendarConnect';
import { useNavigate, Link } from 'react-router-dom';
import { Users, CheckCircle2, Clock, GraduationCap, ClipboardList, FileText, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { courseName, findReport, leadersOfCoach, monthKey, observationCompletion, userName, coursesOfLeader } from '@/data/calc';
import { useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatCard, ReportStatusBadge, ObservationBadge, Progress, AutomationNote } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { fmtDay, fmtTime } from '@/lib/utils';

export function CoachOverview() {
  const { db, now } = useStore();
  const { id, user } = useMe();
  const navigate = useNavigate();
  const leaders = leadersOfCoach(db, id);
  const comp = observationCompletion(db, leaders);
  const upcomingEdu = db.eduActivities.filter((e) => e.status === 'scheduled' && parseISO(e.start) >= new Date(now.toDateString())).sort((a, b) => a.start.localeCompare(b.start));
  const mySurveys = db.surveys.filter((s) => s.coachId === id && s.status === 'sent');
  const awaiting = mySurveys.reduce((n, s) => n + (s.recipientIds.length - s.responses.length), 0);
  const report = findReport(db, id, monthKey(now));

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} description="Quality assurance and professional development for your SI leaders." />
      <CalendarConnect variant="banner" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Assigned SI leaders" value={leaders.length} onClick={() => navigate('/coach/leaders')} />
        <StatCard icon={CheckCircle2} label="Observations completed" value={comp.done} tone="success" hint={`${comp.rate}% of ${comp.total}`} onClick={() => navigate('/coach/observations')} />
        <StatCard icon={Clock} label="Observations pending" value={comp.total - comp.done} tone="warning" onClick={() => navigate('/coach/observations')} />
        <StatCard icon={GraduationCap} label="Upcoming EDU1/EDU2" value={upcomingEdu.length} tone="teal" onClick={() => navigate('/coach/edu')} />
        <StatCard icon={ClipboardList} label="Survey responses awaited" value={awaiting} onClick={() => navigate('/coach/surveys')} />
        <StatCard icon={FileText} label="Monthly report" value={<span className="text-base"><ReportStatusBadge status={report?.status ?? 'none'} /></span>} hint={format(now, 'MMMM yyyy')} onClick={() => navigate('/coach/reports')} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Observation progress</CardTitle><Link to="/coach/observations" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">Manage <ArrowRight className="size-4" /></Link></CardHeader>
          <CardContent className="space-y-3">
            <Progress value={comp.rate} />
            <div className="divide-y divide-border">
              {leaders.map((l) => {
                const obs = db.observations.filter((o) => o.leaderId === l).sort((a, b) => a.number - b.number);
                return (
                  <div key={l} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div><p className="text-sm font-medium text-navy">{userName(db, l)}</p><p className="text-xs text-muted">{coursesOfLeader(db, l).map((c) => courseName(db, c)).join(', ')}</p></div>
                    <div className="flex flex-wrap gap-2">{obs.map((o) => <span key={o.id} className="flex items-center gap-1 text-xs text-muted">#{o.number}<ObservationBadge status={o.status} /></span>)}</div>
                  </div>
                );
              })}
            </div>
            <AutomationNote>Observations automatically contribute to the coach’s reporting record.</AutomationNote>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Upcoming EDU activities</CardTitle><Link to="/coach/edu" className="text-sm font-medium text-teal hover:underline">All</Link></CardHeader>
            <CardContent className="space-y-3">
              {upcomingEdu.slice(0, 3).map((e) => (
                <div key={e.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2"><Badge tone="teal">{e.categoryId}</Badge><span className="text-xs text-muted">{fmtDay(e.start)}, {fmtTime(e.start)}</span></div>
                  <p className="mt-1 text-sm font-medium text-navy">{e.title}</p>
                  <p className="text-xs text-muted">{e.location} · {e.participantIds.length} participants</p>
                </div>
              ))}
              {!upcomingEdu.length ? <p className="text-sm text-muted">Nothing scheduled.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Surveys</CardTitle><Link to="/coach/surveys" className="text-sm font-medium text-teal hover:underline">Open</Link></CardHeader>
            <CardContent className="space-y-3">
              {mySurveys.map((s) => (
                <div key={s.id}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-navy">{s.title}</span><span className="text-muted">{s.responses.length}/{s.recipientIds.length}</span></div>
                  <div className="mt-1.5"><Progress value={s.recipientIds.length ? (s.responses.length / s.recipientIds.length) * 100 : 0} tone="navy" /></div>
                </div>
              ))}
              {!mySurveys.length ? <p className="text-sm text-muted">No active surveys.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
