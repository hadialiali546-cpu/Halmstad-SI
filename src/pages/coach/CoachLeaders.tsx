import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { subMonths } from 'date-fns';
import { useStore } from '@/data/store';
import { courseName, coursesOfLeader, findReport, leadersOfCoach, monthKey, sessionStats, userById } from '@/data/calc';
import { useAttendance, useMe } from '@/lib/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, ObservationBadge, ReportStatusBadge, Avatar } from '@/components/ui/misc';
import { monthLabel } from '@/data/calc';

export function CoachLeaders() {
  const { db, now } = useStore();
  const { id } = useMe();
  const att = useAttendance();
  const navigate = useNavigate();
  const leaders = leadersOfCoach(db, id);
  const prev = monthKey(subMonths(now, 1));
  return (
    <div>
      <PageHeader title="My SI Leaders" description="Overview of the SI leaders you coach. All figures come from their registered sessions." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {leaders.map((l) => {
          const u = userById(db, l)!;
          const st = sessionStats(db.sessions.filter((s) => s.leaderId === l), att, now);
          const obs = db.observations.filter((o) => o.leaderId === l).sort((a, b) => a.number - b.number);
          const eduDone = db.eduActivities.filter((e) => e.status === 'completed' && e.attendedIds.includes(l)).map((e) => e.categoryId);
          const responded = db.surveys.filter((s) => s.coachId === id && s.recipientIds.includes(l)).every((s) => s.responses.some((r) => r.respondentId === l));
          const rep = findReport(db, l, prev);
          return (
            <Card key={l}>
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} className="size-10" />
                  <div className="min-w-0 flex-1"><p className="font-semibold text-navy">{u.name}</p><p className="truncate text-xs text-muted">{coursesOfLeader(db, l).map((c) => courseName(db, c)).join(', ')}</p></div>
                  <a href={`mailto:${u.email}`} className="text-muted hover:text-teal" aria-label={`Email ${u.name}`}><Mail className="size-4" /></a>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-canvas p-2"><p className="text-lg font-semibold text-navy">{st.completed}</p><p className="text-[11px] text-muted">Sessions</p></div>
                  <div className="rounded-lg bg-canvas p-2"><p className="text-lg font-semibold text-navy">{st.avg}</p><p className="text-[11px] text-muted">Avg. attendance</p></div>
                  <div className="rounded-lg bg-canvas p-2"><p className={st.pending ? 'text-lg font-semibold text-warning' : 'text-lg font-semibold text-navy'}>{st.pending}</p><p className="text-[11px] text-muted">Pending att.</p></div>
                </div>
                <div className="space-y-1.5 text-sm">
                  {obs.map((o) => <div key={o.id} className="flex items-center justify-between"><span className="text-muted">Observation {o.number}</span><ObservationBadge status={o.status} /></div>)}
                  <div className="flex items-center justify-between"><span className="text-muted">EDU completed</span><span className="font-medium text-slate-700">{Array.from(new Set(eduDone)).join(', ') || '—'}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted">Survey response</span><span className="font-medium text-slate-700">{responded ? 'Answered' : 'Outstanding'}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted">{monthLabel(prev)} report</span><ReportStatusBadge status={rep?.status ?? 'none'} /></div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/coach/observations')}>Observations</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
