import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Save, ArrowRight, Search, UserPlus, Users, Check, QrCode } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { courseName, coursesOfLeader, monthKey, sessionStatus, sessionStats, studentsOfCourse, uniqueStudents, userName } from '@/data/calc';
import { useAttendance, useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { PageHeader, AutomationNote, SessionStatusBadge, Avatar } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { cn, fmtDateTime, fmtDay, fmtTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function LeaderAttendance() {
  const { db, actions, now } = useStore();
  const { id } = useMe();
  const att = useAttendance();
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const courses = coursesOfLeader(db, id);
  const eligible = useMemo(
    () => db.sessions.filter((s) => s.leaderId === id && !s.cancelled && parseISO(s.start) <= now).reverse(),
    [db.sessions, id, now],
  );
  const firstPending = eligible.find((s) => sessionStatus(s, att, now) === 'attendance_pending');
  const [sessionId, setSessionId] = useState(params.get('session') ?? firstPending?.id ?? eligible[0]?.id ?? '');
  const session = db.sessions.find((s) => s.id === sessionId);
  const [courseId, setCourseId] = useState(session?.courseId ?? courses[0] ?? '');
  const existing = session ? att.get(session.id) : undefined;
  const [selected, setSelected] = useState<string[]>(existing?.studentIds ?? []);
  const [guests, setGuests] = useState(String(existing?.guests ?? 0));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [q, setQ] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const [lastSaved, setLastSaved] = useState<{ sessionId: string; count: number; named: number } | null>(null);

  const loadFrom = (sid: string) => {
    const a = att.get(sid);
    const sess = db.sessions.find((x) => x.id === sid);
    setSelected(a?.studentIds ?? sess?.checkin?.studentIds ?? []);
    setGuests(String(a?.guests ?? (a && !a.studentIds?.length ? a.count : 0)));
    setNotes(a?.notes ?? '');
    setEditMode(false);
    setError('');
    setQ('');
  };
  useEffect(() => {
    const p = params.get('session');
    if (p && p !== sessionId) setSessionId(p);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const s = db.sessions.find((x) => x.id === sessionId);
    if (s) setCourseId(s.courseId);
    loadFrom(sessionId);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const courseSessions = eligible.filter((s) => s.courseId === courseId);
  const locked = !!existing && !editMode;
  const roster = useMemo(
    () => (session ? studentsOfCourse(db, session.courseId).map((sid) => db.users.find((u) => u.id === sid)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'sv')) : []),
    [db, session],
  );
  // How many of this leader's sessions each student has attended (helps leaders recognise regulars)
  const attendedCount = useMemo(() => {
    const m = new Map<string, number>();
    db.sessions.filter((s) => s.leaderId === id).forEach((s) => att.get(s.id)?.studentIds?.forEach((sid) => m.set(sid, (m.get(sid) ?? 0) + 1)));
    return m;
  }, [db.sessions, att, id]);
  const visible = roster.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()));
  const g = Math.max(0, Number(guests) || 0);
  const total = selected.length + g;
  const toggle = (sid: string) => !locked && setSelected((s) => (s.includes(sid) ? s.filter((x) => x !== sid) : [...s, sid]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!session) return setError('Choose a session.');
    if (!Number.isInteger(Number(guests)) || Number(guests) < 0) return setError('Guests must be a whole number (0 or more).');
    if (total === 0) return setError('Select the students who attended (or add guests).');
    if (existing && !editMode) return setError('Attendance is already registered. Choose “Edit existing record” to change it.');
    actions.recordAttendance(session.id, selected, g, notes.trim(), id);
    setLastSaved({ sessionId: session.id, count: total, named: selected.length });
    setEditMode(false);
    setParams({ session: session.id }, { replace: true });
    toast({ title: existing ? 'Attendance updated' : 'Attendance saved', body: `${total} attendees · statistics, report draft and supervisor dashboard are updated.` });
  };

  const month = session ? monthKey(session.start) : monthKey(now);
  const monthSessions = db.sessions.filter((s) => s.leaderId === id && monthKey(s.start) === month);
  const mStats = sessionStats(monthSessions, att, now);
  const recent = db.sessions.filter((s) => s.leaderId === id && att.has(s.id)).slice(-8).reverse();

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Tick the students who attended — the platform reuses the register for statistics and reporting." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-col"><CardTitle>Register attendance</CardTitle><CardDescription>Select attending students from the course list. Guests are students not on the list.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Course" htmlFor="att-course">
                  <Select id="att-course" value={courseId} onChange={(e) => {
                    setCourseId(e.target.value);
                    const s = eligible.find((x) => x.courseId === e.target.value);
                    setSessionId(s?.id ?? '');
                  }}>
                    {courses.map((c) => <option key={c} value={c}>{courseName(db, c)}</option>)}
                  </Select>
                </Field>
                <Field label="Session" htmlFor="att-session">
                  <Select id="att-session" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                    {courseSessions.map((s) => {
                      const st = sessionStatus(s, att, now);
                      return <option key={s.id} value={s.id}>{fmtDay(s.start)} {fmtTime(s.start)} — {st === 'attendance_pending' ? '⚠ pending' : `${att.get(s.id)?.count} registered`}</option>;
                    })}
                  </Select>
                </Field>
              </div>
              {session ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-canvas px-4 py-3 text-sm">
                  <div><p className="text-xs text-muted">Date and time</p><p className="font-medium text-navy">{format(parseISO(session.start), 'EEEE d MMMM yyyy, HH:mm')} ({session.durationMin} min)</p></div>
                  <div><p className="text-xs text-muted">Topic</p><p className="font-medium text-navy">{session.topic}</p></div>
                  <SessionStatusBadge status={sessionStatus(session, att, now)} />
                </div>
              ) : null}
              {existing ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-bg/60 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-700"><AlertTriangle className="size-4 text-warning" />Attendance already registered ({existing.count}) on {fmtDateTime(existing.editedAt ?? existing.recordedAt)}.</span>
                  {!editMode ? <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>Edit existing record</Button> : <span className="text-xs font-medium text-warning">Editing existing record</span>}
                </div>
              ) : null}

              {!existing && session?.checkin?.studentIds.length ? (
                <div className="flex items-center gap-2 rounded-lg border border-teal-100 bg-teal-50/70 px-4 py-2.5 text-sm text-teal-700">
                  <QrCode className="size-4 shrink-0" />Pre-filled from {session.checkin.studentIds.length} QR check-ins{session.checkin.closedAt ? '' : ' (check-in still open)'} — review and tick anyone who didn’t scan.
                </div>
              ) : null}
              {/* Class list */}
              <div className="rounded-xl border border-border">
                <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${roster.length} students on the course list`} className="pl-9" />
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" disabled={locked} onClick={() => setSelected(Array.from(new Set([...selected, ...visible.map((u) => u.id)])))}>Select all</Button>
                    <Button size="sm" variant="ghost" disabled={locked || !selected.length} onClick={() => setSelected([])}>Clear</Button>
                  </div>
                </div>
                <div className="grid max-h-[340px] gap-1 overflow-y-auto p-2 sm:grid-cols-2" role="group" aria-label="Attending students">
                  {visible.map((u) => {
                    const on = selected.includes(u.id);
                    const n = attendedCount.get(u.id) ?? 0;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={locked}
                        onClick={() => toggle(u.id)}
                        className={cn('flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition disabled:cursor-not-allowed',
                          on ? 'border-teal bg-teal-50 text-navy' : 'border-transparent hover:bg-muted-bg', locked && !on && 'opacity-50')}
                      >
                        <span className={cn('grid size-5 shrink-0 place-items-center rounded border', on ? 'border-teal bg-teal text-white' : 'border-slate-300 bg-white')}>{on ? <Check className="size-3.5" /> : null}</span>
                        <Avatar name={u.name} className="size-7 text-[10px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{u.name}</span>
                          <span className="block text-[11px] text-muted">{n ? `Attended ${n} of your sessions` : 'First time'}</span>
                        </span>
                      </button>
                    );
                  })}
                  {!visible.length ? <p className="col-span-2 p-4 text-center text-sm text-muted">No students match “{q}”.</p> : null}
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border p-3">
                  <Field label="Guests (not on course list)" htmlFor="att-guests" className="w-48">
                    <div className="relative">
                      <UserPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                      <Input id="att-guests" type="number" min={0} value={guests} onChange={(e) => { setGuests(e.target.value); setError(''); }} disabled={locked} className="pl-9" />
                    </div>
                  </Field>
                  <div className="text-right" aria-live="polite">
                    <p className="text-xs text-muted">Total attending</p>
                    <p className="text-2xl font-semibold tabular-nums text-navy" data-testid="att-total">{total}</p>
                    <p className="text-xs text-muted">{selected.length} named · {g} guest{g === 1 ? '' : 's'}</p>
                  </div>
                </div>
              </div>

              <Field label="Session notes (optional)" htmlFor="att-notes">
                <Textarea id="att-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} placeholder="e.g. Worked through exam problems in groups" className="min-h-[38px]" rows={2} />
              </Field>
              {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!session || locked}><Save />{editMode ? 'Save changes' : t('Save attendance')}</Button>
                {editMode ? <Button variant="ghost" onClick={() => loadFrom(sessionId)}>Cancel edit</Button> : null}
              </div>
            </form>
            {lastSaved && lastSaved.sessionId === sessionId ? (
              <div className="mt-5 rounded-lg border border-success/30 bg-success-bg/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="size-4" />Saved {lastSaved.count} attendees ({lastSaved.named} by name) — automatically updated:</p>
                <ul className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
                  <li>✓ Session status → Completed</li>
                  <li>✓ {format(parseISO(month + '-01'), 'MMMM')} totals: {mStats.attendance} attendance · {mStats.completed} sessions</li>
                  <li>✓ Course analytics for {courseName(db, session!.courseId)}</li>
                  <li>✓ Each student’s SI attendance history</li>
                  <li>✓ Monthly report draft (if generated)</li>
                  <li>✓ Supervisor dashboard &amp; reminders</li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate('/leader/reports')}>Open monthly report <ArrowRight /></Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/supervisor/courses/${session!.courseId}`)}>View as supervisor <ArrowRight /></Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-col"><CardTitle>{format(parseISO(month + '-01'), 'MMMM yyyy')} so far</CardTitle><CardDescription>Calculated from registered attendance</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[['Sessions completed', mStats.completed], ['Session hours', mStats.hours], ['Attendance instances', mStats.attendance], ['Unique students', uniqueStudents(monthSessions, att)], ['Average / session', mStats.avg], ['Pending registrations', mStats.pending]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-canvas p-3"><p className="text-xs text-muted">{k}</p><p className="text-xl font-semibold tabular-nums text-navy">{v}</p></div>
              ))}
            </CardContent>
          </Card>
          <AutomationNote>Attendance automatically updates course statistics and monthly reports. Registering by name also shows how many different students SI reaches — not just attendance totals.</AutomationNote>
          <AutomationNote>Duplicate registrations are blocked unless you explicitly edit the existing record.</AutomationNote>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Recently registered</CardTitle></CardHeader>
        <Table>
          <THead><TR><TH>Session</TH><TH>Course</TH><TH className="text-right">Attendance</TH><TH className="hidden lg:table-cell">Students</TH><TH className="hidden sm:table-cell">Registered</TH><TH /></TR></THead>
          <TBody>
            {recent.map((s) => {
              const a = att.get(s.id)!;
              const names = (a.studentIds ?? []).map((x) => userName(db, x).split(' ')[0]);
              return (
                <TR key={s.id}>
                  <TD className="whitespace-nowrap">{fmtDay(s.start)}, {fmtTime(s.start)}</TD>
                  <TD>{courseName(db, s.courseId)}</TD>
                  <TD className="text-right font-medium tabular-nums">{a.count}</TD>
                  <TD className="hidden max-w-sm lg:table-cell">
                    <span className="flex items-center gap-1.5 text-muted"><Users className="size-3.5 shrink-0" /><span className="truncate">{names.length ? names.join(', ') : 'Not itemised'}{a.guests ? ` + ${a.guests} guest${a.guests > 1 ? 's' : ''}` : ''}</span></span>
                  </TD>
                  <TD className="hidden whitespace-nowrap text-muted sm:table-cell">{fmtDateTime(a.editedAt ?? a.recordedAt)}{a.editedAt ? ' (edited)' : ''}</TD>
                  <TD><Button size="sm" variant="ghost" onClick={() => setSessionId(s.id)}>Open</Button></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
