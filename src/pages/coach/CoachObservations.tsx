import { useState } from 'react';
import { CalendarPlus, FileEdit, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useStore } from '@/data/store';
import { courseName, leadersOfCoach, observationCompletion, userName } from '@/data/calc';
import type { Observation } from '@/data/types';
import { useMe } from '@/lib/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { PageHeader, ObservationBadge, Tabs, Progress, AutomationNote } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { ObservationForm } from './ObservationForm';
import { fmtDate } from '@/lib/utils';

export function CoachObservations() {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const leaders = leadersOfCoach(db, id);
  const [tab, setTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [openObs, setOpenObs] = useState<Observation | null>(null);
  const [sched, setSched] = useState<Observation | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const comp = observationCompletion(db, leaders);

  const rows = leaders.map((l) => {
    const obs = db.observations.filter((o) => o.leaderId === l).sort((a, b) => a.number - b.number);
    return { leaderId: l, courseId: obs[0]?.courseId, obs };
  }).filter((r) => tab === 'all' || (tab === 'pending' ? r.obs.some((o) => o.status !== 'completed') : r.obs.every((o) => o.status === 'completed')));

  const Cell = ({ o }: { o?: Observation }) => {
    if (!o) return <span className="text-muted">—</span>;
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2"><ObservationBadge status={o.status} />{o.date ? <span className="text-xs text-muted">{fmtDate(o.date)}</span> : null}</div>
        <div className="flex flex-wrap gap-1">
          {o.status === 'completed' ? (
            <Button size="sm" variant="ghost" onClick={() => setOpenObs(o)}><Eye />Review</Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setSched(o); setDate(o.date ?? format(new Date(), 'yyyy-MM-dd')); }}><CalendarPlus />{o.date ? 'Reschedule' : 'Schedule'}</Button>
              <Button size="sm" variant="outline" onClick={() => setOpenObs(o)}><FileEdit />Open form</Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Observations" description="Each SI leader requires two observations during the observation period (HT2026)." />
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-medium text-navy">{comp.done} of {comp.total} observations completed</p>
            <div className="mt-2"><Progress value={comp.rate} /></div>
          </div>
          <Tabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }]} />
        </CardContent>
      </Card>
      <Card>
        <Table>
          <THead><TR><TH>SI Leader</TH><TH>Course</TH><TH>Observation 1</TH><TH>Observation 2</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.leaderId}>
                <TD className="font-medium text-navy">{userName(db, r.leaderId)}</TD>
                <TD>{r.courseId ? courseName(db, r.courseId) : '—'}</TD>
                <TD><Cell o={r.obs.find((o) => o.number === 1)} /></TD>
                <TD><Cell o={r.obs.find((o) => o.number === 2)} /></TD>
              </TR>
            ))}
            {!rows.length ? <TR><TD colSpan={4} className="py-8 text-center text-muted">No SI leaders match this filter.</TD></TR> : null}
          </TBody>
        </Table>
      </Card>
      <AutomationNote>Observations automatically contribute to the coach’s reporting record. Completion status is a process measure and does not by itself indicate the SI leader’s performance quality.</AutomationNote>

      <ObservationForm obs={openObs} onClose={() => setOpenObs(null)} />
      <Dialog open={!!sched} onOpenChange={(o) => !o && setSched(null)} title="Schedule observation" description={sched ? `${userName(db, sched.leaderId)} · Observation ${sched.number}` : ''} footer={<>
        <Button variant="outline" onClick={() => setSched(null)}>Cancel</Button>
        <Button onClick={() => { actions.scheduleObservation(sched!.id, date); toast({ title: 'Observation scheduled', body: `${userName(db, sched!.leaderId)} has been notified.` }); setSched(null); }} disabled={!date}>Schedule</Button></>}>
        <Field label="Date" htmlFor="sched-date"><Input id="sched-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {sched ? (
          <div className="mt-3 text-sm text-muted">
            Upcoming sessions: {db.sessions.filter((s) => s.leaderId === sched.leaderId && new Date(s.start) > new Date() && !s.cancelled).slice(0, 3).map((s) => (
              <button key={s.id} className="ml-1 rounded bg-navy-50 px-1.5 py-0.5 text-xs text-navy hover:bg-teal-50" onClick={() => setDate(format(new Date(s.start), 'yyyy-MM-dd'))}>{fmtDate(s.start)}</button>
            ))}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
