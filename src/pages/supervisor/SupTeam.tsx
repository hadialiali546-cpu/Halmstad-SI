import { useMemo, useState } from 'react';
import { X, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { subMonths } from 'date-fns';
import { useStore } from '@/data/store';
import { attendanceMap, coachOfLeader, courseName, coursesOfLeader, findReport, leadersOfCoach, monthKey, monthLabel, sessionStatus, userName, usersByRole } from '@/data/calc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { PageHeader, AutomationNote, Avatar } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { AccessRequests } from '@/components/shared/AccessRequests';
import { fmtDay } from '@/lib/utils';

export function SupTeam() {
  const { db, actions, now } = useStore();
  const toast = useToast();
  const att = useMemo(() => attendanceMap(db), [db]);
  const leaders = usersByRole(db, 'leader');
  const coaches = usersByRole(db, 'coach');
  const [adding, setAdding] = useState<Record<string, string>>({});
  const prev = monthKey(subMonths(now, 1));

  const tasks: { who: string; what: string; tone: 'warning' | 'danger' }[] = [];
  leaders.forEach((l) => {
    const pend = db.sessions.filter((s) => s.leaderId === l.id && sessionStatus(s, att, now) === 'attendance_pending').length;
    if (pend) tasks.push({ who: l.name, what: `${pend} session(s) missing attendance`, tone: 'warning' });
    const notSched = db.observations.filter((o) => o.leaderId === l.id && o.status === 'not_scheduled').length;
    if (notSched) tasks.push({ who: l.name, what: `${notSched} observation(s) not yet scheduled`, tone: 'warning' });
    if (!coachOfLeader(db, l.id)) tasks.push({ who: l.name, what: 'No SI coach assigned', tone: 'danger' });
    if (!coursesOfLeader(db, l.id).length) tasks.push({ who: l.name, what: 'Not assigned to any course', tone: 'danger' });
  });
  [...leaders, ...coaches].forEach((u) => {
    const r = findReport(db, u.id, prev);
    if (!r || r.status === 'draft') tasks.push({ who: u.name, what: `${monthLabel(prev)} report not submitted`, tone: 'warning' });
    else if (r.status === 'returned') tasks.push({ who: u.name, what: `${monthLabel(prev)} report returned — awaiting correction`, tone: 'danger' });
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Team Management" description="Course and coaching assignments. Changes apply across all dashboards immediately." />
      <AccessRequests />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex-col"><CardTitle>Course assignments</CardTitle><CardDescription>Assign SI leaders to courses</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {db.courses.map((c) => {
              const as = db.courseAssignments.filter((a) => a.courseId === c.id);
              const avail = leaders.filter((l) => !as.some((a) => a.leaderId === l.id));
              return (
                <div key={c.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="font-medium text-navy">{c.name}</p><p className="text-xs text-muted">{c.code} · {c.faculty}</p></div>
                    <div className="flex items-center gap-2">
                      <Select aria-label={`Add SI leader to ${c.name}`} value={adding[c.id] ?? ''} onChange={(e) => setAdding({ ...adding, [c.id]: e.target.value })} className="h-8 w-44 text-xs">
                        <option value="">Add SI leader…</option>
                        {avail.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </Select>
                      <Button size="sm" disabled={!adding[c.id]} onClick={() => { actions.assignLeaderToCourse(c.id, adding[c.id]); toast({ title: 'Leader assigned', body: `${userName(db, adding[c.id])} → ${c.name}` }); setAdding({ ...adding, [c.id]: '' }); }}><Plus />Assign</Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {as.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 py-1 pl-2.5 pr-1 text-xs font-medium text-navy">
                        {userName(db, a.leaderId)}
                        <button className="rounded-full p-0.5 hover:bg-navy-100" aria-label={`Remove ${userName(db, a.leaderId)}`} onClick={() => { actions.removeCourseAssignment(a.id); toast({ title: 'Assignment removed', tone: 'info' }); }}><X className="size-3" /></button>
                      </span>
                    ))}
                    {!as.length ? <span className="text-xs text-danger">No SI leader assigned</span> : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader className="flex-col"><CardTitle>Missing administrative tasks</CardTitle><CardDescription>Generated from current records</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${t.tone === 'danger' ? 'bg-danger-bg/70' : 'bg-warning-bg/70'}`}>
                <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${t.tone === 'danger' ? 'text-danger' : 'text-warning'}`} />
                <span><span className="font-medium text-navy">{t.who}</span> — {t.what}</span>
              </div>
            ))}
            {!tasks.length ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />Everything is up to date.</p> : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex-col"><CardTitle>SI leaders and coaches</CardTitle><CardDescription>Assign an SI coach to each SI leader. Pending observations follow the new coach.</CardDescription></CardHeader>
        <Table>
          <THead><TR><TH>SI leader</TH><TH>Courses</TH><TH>SI coach</TH><TH className="hidden md:table-cell">Observations</TH></TR></THead>
          <TBody>
            {leaders.map((l) => (
              <TR key={l.id}>
                <TD><div className="flex items-center gap-2"><Avatar name={l.name} /><span className="font-medium text-navy">{l.name}</span>{l.source === 'import' ? <span className="text-xs text-muted">(imported)</span> : null}</div></TD>
                <TD>{coursesOfLeader(db, l.id).map((c) => courseName(db, c)).join(', ') || '—'}</TD>
                <TD>
                  <Select aria-label={`Coach for ${l.name}`} value={coachOfLeader(db, l.id) ?? ''} onChange={(e) => { actions.setCoach(l.id, e.target.value); toast({ title: 'Coach updated' }); }} className="h-8 w-44 text-xs">
                    <option value="">— none —</option>
                    {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </TD>
                <TD className="hidden md:table-cell">{db.observations.filter((o) => o.leaderId === l.id && o.status === 'completed').length} / {Math.max(2, db.observations.filter((o) => o.leaderId === l.id).length)} completed</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <Card>
        <CardHeader><CardTitle>Team responsibilities</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {coaches.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2"><Avatar name={c.name} /><div><p className="font-medium text-navy">{c.name}</p><p className="text-xs text-muted">SI coach · {leadersOfCoach(db, c.id).length} leaders</p></div></div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">{leadersOfCoach(db, c.id).map((l) => <li key={l}>• {userName(db, l)} <span className="text-muted">({coursesOfLeader(db, l).map((x) => courseName(db, x)).join(', ')})</span></li>)}</ul>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-col"><CardTitle>Substitute requests</CardTitle><CardDescription>SI leaders covering for each other — the substitute’s report includes the session automatically</CardDescription></CardHeader>
        <Table>
          <THead><TR><TH>Session</TH><TH>Requested by</TH><TH>Reason</TH><TH>Status</TH></TR></THead>
          <TBody>
            {[...db.substituteRequests].reverse().map((r) => {
              const s = db.sessions.find((x) => x.id === r.sessionId);
              return (
                <TR key={r.id}>
                  <TD>{s ? `${courseName(db, s.courseId)} · ${fmtDay(s.start)}` : '—'}</TD>
                  <TD>{userName(db, r.requesterId)}</TD>
                  <TD className="text-muted">{r.reason}</TD>
                  <TD>{r.status === 'open' ? <span className="text-warning">Open</span> : r.status === 'accepted' ? <span className="text-success">Covered by {userName(db, r.substituteId ?? '')}</span> : <span className="text-muted">Withdrawn</span>}</TD>
                </TR>
              );
            })}
            {!db.substituteRequests.length ? <TR><TD colSpan={4} className="text-center text-muted">No requests.</TD></TR> : null}
          </TBody>
        </Table>
      </Card>
      <AutomationNote>Assignments drive what each SI leader and coach sees on their dashboards — no separate lists to maintain.</AutomationNote>
    </div>
  );
}
