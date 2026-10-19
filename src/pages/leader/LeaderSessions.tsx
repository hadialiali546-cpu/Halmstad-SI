import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Ban, RotateCcw, ClipboardCheck, Pencil, QrCode, NotebookPen, UserRoundX, Paperclip } from 'lucide-react';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { CheckinPanel } from '@/components/shared/CheckinPanel';
import { SessionPlanDialog } from '@/components/shared/SessionPlanDialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/form';
import { userName } from '@/data/calc';
import { format, parseISO, startOfWeek } from 'date-fns';
import { useStore } from '@/data/store';
import { courseName, coursesOfLeader, sessionStatus } from '@/data/calc';
import type { SessionStatus } from '@/data/types';
import { useAttendance, useMe } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader, SessionStatusBadge, Tabs, EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { fmtDay, fmtTime } from '@/lib/utils';

export function LeaderSessions() {
  const { db, actions, now } = useStore();
  const { id } = useMe();
  const att = useAttendance();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | SessionStatus>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [checkinFor, setCheckinFor] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [subFor, setSubFor] = useState<string | null>(null);
  const [subReason, setSubReason] = useState('');
  const openSub = (sid: string) => db.substituteRequests.find((r) => r.sessionId === sid && r.status === 'open');
  /** Check-in can be started from 60 min before start until attendance is registered */
  const canCheckin = (s: (typeof db.sessions)[number], st: SessionStatus) =>
    st === 'attendance_pending' || (st === 'scheduled' && differenceInMinutes(parseISO(s.start), now) <= 60 && addMinutes(parseISO(s.start), s.durationMin) > now);
  const courses = coursesOfLeader(db, id);
  const mine = db.sessions.filter((s) => s.leaderId === id);
  const withStatus = mine.map((s) => ({ s, st: sessionStatus(s, att, now) }));
  const count = (st: SessionStatus) => withStatus.filter((x) => x.st === st).length;
  const list = withStatus.filter((x) => (tab === 'all' || x.st === tab) && (q === '' || (x.s.topic + courseName(db, x.s.courseId)).toLowerCase().includes(q.toLowerCase())));

  // Group by week
  const groups = new Map<string, typeof list>();
  list.forEach((x) => {
    const k = format(startOfWeek(parseISO(x.s.start), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    groups.set(k, [...(groups.get(k) ?? []), x]);
  });

  // New session form
  const [form, setForm] = useState({ courseId: courses[0] ?? '', date: format(now, 'yyyy-MM-dd'), time: '14:00', duration: '120', location: '', topic: '', repeat: '1' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.courseId) e.courseId = 'Choose a course.';
    if (!form.date) e.date = 'Choose a date.';
    if (!/^\d{2}:\d{2}$/.test(form.time)) e.time = 'Use HH:mm.';
    const d = Number(form.duration);
    if (!d || d < 30 || d > 240) e.duration = 'Between 30 and 240 minutes.';
    if (form.location.trim().length < 2) e.location = 'Location is required.';
    if (form.topic.trim().length < 2) e.topic = 'Suggested topic is required.';
    const rep = Number(form.repeat);
    if (!Number.isInteger(rep) || rep < 1 || rep > 15) e.repeat = '1–15 weeks.';
    setErrors(e);
    if (Object.keys(e).length) return;
    actions.addSession({
      courseId: form.courseId, leaderId: id, start: parseISO(`${form.date}T${form.time}`).toISOString(), durationMin: d,
      location: form.location.trim(), topic: form.topic.trim(), source: 'leader',
    }, rep);
    setOpen(false);
    setForm({ ...form, location: '', topic: '', repeat: '1' });
    toast({ title: rep > 1 ? `${rep} weekly sessions scheduled` : 'Session scheduled', body: 'Students on the course have been notified in the app.' });
  };

  return (
    <div>
      <PageHeader
        title="My Sessions"
        description="All your SI sessions. Status is derived automatically from the schedule and registered attendance."
        actions={<Button onClick={() => setOpen(true)}><Plus />Schedule session</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'all', label: 'All', count: mine.length },
          { value: 'scheduled', label: 'Scheduled', count: count('scheduled') },
          { value: 'attendance_pending', label: 'Attendance pending', count: count('attendance_pending') },
          { value: 'completed', label: 'Completed', count: count('completed') },
          { value: 'cancelled', label: 'Cancelled', count: count('cancelled') },
        ]} />
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search sessions" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search topic or course" className="pl-9" />
        </div>
      </div>
      {list.length === 0 ? <EmptyState title="No sessions match" body="Try another filter." /> : (
        <div className="space-y-5">
          {[...groups.entries()].reverse().map(([week, items]) => (
            <div key={week}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Week of {fmtDay(week)}</p>
              <Card className="divide-y divide-border">
                {items.map(({ s, st }) => (
                  <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="w-32 shrink-0 text-sm"><p className="font-medium text-navy">{fmtDay(s.start)}</p><p className="text-muted">{fmtTime(s.start)} · {s.durationMin} min</p></div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-slate-800">{s.topic}</p>
                      <p className="text-muted">{courseName(db, s.courseId)} · {s.location}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {st === 'scheduled' ? (s.plan ? <Badge tone="teal">Plan ready</Badge> : parseISO(s.start) < addMinutes(now, 7 * 24 * 60) ? <Badge tone="warning">No plan yet</Badge> : null) : null}
                        {s.materials?.length ? <Badge tone="neutral"><Paperclip className="size-3" />{s.materials.length}</Badge> : null}
                        {s.checkin ? <Badge tone="navy"><QrCode className="size-3" />{s.checkin.studentIds.length} checked in</Badge> : null}
                        {openSub(s.id) ? <Badge tone="warning">Substitute requested</Badge> : null}
                        {s.originalLeaderId ? <Badge tone="neutral">Covering for {userName(db, s.originalLeaderId)}</Badge> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {st === 'completed' ? <span className="text-sm tabular-nums text-slate-600">{att.get(s.id)!.count} attended</span> : null}
                      <SessionStatusBadge status={st} />
                      {canCheckin(s, st) ? <Button size="sm" variant="outline" onClick={() => setCheckinFor(s.id)}><QrCode />{s.checkin && !s.checkin.closedAt ? 'Check-in open' : 'QR check-in'}</Button> : null}
                      {st === 'attendance_pending' ? <Button size="sm" onClick={() => navigate(`/leader/attendance?session=${s.id}`)}><ClipboardCheck />Register</Button> : null}
                      {st === 'scheduled' ? <Button size="sm" variant="ghost" onClick={() => setPlanFor(s.id)}><NotebookPen />Plan</Button> : null}
                      {st === 'scheduled' && !openSub(s.id) ? <Button size="sm" variant="ghost" aria-label="Request substitute" title="Request substitute" onClick={() => { setSubFor(s.id); setSubReason(''); }}><UserRoundX /></Button> : null}
                      {st === 'completed' ? <Button size="sm" variant="ghost" onClick={() => navigate(`/leader/attendance?session=${s.id}`)} aria-label="Edit attendance"><Pencil /></Button> : null}
                      {st === 'scheduled' ? <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(s.id)} aria-label="Cancel session"><Ban /></Button> : null}
                      {st === 'cancelled' && parseISO(s.start) > now ? <Button size="sm" variant="ghost" onClick={() => actions.setSessionCancelled(s.id, false)} aria-label="Restore session"><RotateCcw /></Button> : null}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen} title="Schedule SI session" description="Students on the course are notified automatically." footer={<>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Schedule</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course" htmlFor="ns-course" error={errors.courseId} className="sm:col-span-2">
            <Select id="ns-course" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              {courses.map((c) => <option key={c} value={c}>{courseName(db, c)}</option>)}
            </Select>
          </Field>
          <Field label="Date" htmlFor="ns-date" error={errors.date}><Input id="ns-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Start time" htmlFor="ns-time" error={errors.time}><Input id="ns-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          <Field label="Duration (minutes)" htmlFor="ns-dur" error={errors.duration}><Input id="ns-dur" type="number" min={30} max={240} step={15} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></Field>
          <Field label="Location" htmlFor="ns-loc" error={errors.location}><Input id="ns-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Building E, Room E305" /></Field>
          <Field label="Suggested topic" htmlFor="ns-topic" error={errors.topic}><Input id="ns-topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Integration by substitution" /></Field>
          <Field label="Repeat weekly" htmlFor="ns-repeat" error={errors.repeat} hint={Number(form.repeat) > 1 ? `Creates ${form.repeat} sessions, same time each week` : 'Single session'}>
            <Select id="ns-repeat" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
              {[1, 2, 4, 6, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n === 1 ? 'Does not repeat' : `${n} weeks`}</option>)}
            </Select>
          </Field>
        </div>
      </Dialog>

      <CheckinPanel sessionId={checkinFor} onClose={() => setCheckinFor(null)} />
      <SessionPlanDialog sessionId={planFor} onClose={() => setPlanFor(null)} />
      <Dialog open={!!subFor} onOpenChange={(o) => !o && setSubFor(null)} title="Request a substitute" description="Other SI leaders on the course and the supervisor are notified." footer={<>
        <Button variant="outline" onClick={() => setSubFor(null)}>Cancel</Button>
        <Button disabled={subReason.trim().length < 3} onClick={() => { actions.requestSubstitute(subFor!, id, subReason.trim()); setSubFor(null); toast({ title: 'Substitute requested', body: 'You will be notified when someone accepts.' }); }}>Send request</Button></>}>
        <Field label="Reason (shared with colleagues)" htmlFor="sub-reason"><Textarea id="sub-reason" value={subReason} onChange={(e) => setSubReason(e.target.value)} placeholder="e.g. I have an exam at the same time" /></Field>
        <p className="mt-2 text-xs text-muted">The substitute takes over the session and gets it in their own monthly report.</p>
      </Dialog>
      <Dialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)} title="Cancel this session?" description="Students on the course will be notified." footer={<>
        <Button variant="outline" onClick={() => setConfirmCancel(null)}>Keep session</Button>
        <Button variant="danger" onClick={() => { actions.setSessionCancelled(confirmCancel!, true); setConfirmCancel(null); toast({ title: 'Session cancelled', tone: 'info' }); }}>Cancel session</Button></>}>
        <p className="text-sm text-muted">Cancelled sessions are excluded from attendance statistics and reports.</p>
      </Dialog>
    </div>
  );
}
