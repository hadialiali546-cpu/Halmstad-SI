import { useState } from 'react';
import { Plus, BellRing, UserCheck, MapPin, Clock, Users, Tag } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { userName, usersByRole } from '@/data/calc';
import type { EducationActivity } from '@/data/types';
import { useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { PageHeader, Tabs, EmptyState, AutomationNote } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, fmtDateTime } from '@/lib/utils';

export function CoachEdu() {
  const { db, actions, now } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const leaders = usersByRole(db, 'leader');
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [cat, setCat] = useState('all');
  const [newOpen, setNewOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [attFor, setAttFor] = useState<EducationActivity | null>(null);
  const [attSel, setAttSel] = useState<string[]>([]);

  const list = db.eduActivities
    .filter((e) => (tab === 'upcoming' ? e.status === 'scheduled' : e.status === 'completed') && (cat === 'all' || e.categoryId === cat))
    .sort((a, b) => (tab === 'upcoming' ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start)));

  const blank = { categoryId: db.eduCategories[1]?.id ?? 'EDU1', title: '', date: format(now, 'yyyy-MM-dd'), time: '13:00', duration: '120', location: '', description: '', participants: leaders.map((l) => l.id) };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const save = () => {
    const e: Record<string, string> = {};
    if (f.title.trim().length < 3) e.title = 'Title is required.';
    if (!f.date) e.date = 'Date is required.';
    if (f.location.trim().length < 2) e.location = 'Location is required.';
    if (!f.participants.length) e.participants = 'Select at least one SI leader.';
    const d = Number(f.duration);
    if (!d || d < 30 || d > 480) e.duration = '30–480 minutes.';
    setErr(e);
    if (Object.keys(e).length) return;
    actions.saveEdu({
      id: `edu-${Date.now()}`, categoryId: f.categoryId, title: f.title.trim(), start: parseISO(`${f.date}T${f.time}`).toISOString(),
      durationMin: d, location: f.location.trim(), description: f.description.trim(), coachId: id,
      participantIds: f.participants, attendedIds: [], status: 'scheduled', remindersSent: 0,
    });
    setNewOpen(false);
    setF(blank);
    toast({ title: 'Activity scheduled', body: 'Participating SI leaders were notified in the app.' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="EDU1 & EDU2"
        description="Educational activities for SI leaders. Categories are configurable so they can match the programme’s actual procedures."
        actions={<><Button variant="outline" onClick={() => setCatOpen(true)}><Tag />Categories</Button><Button onClick={() => setNewOpen(true)}><Plus />Schedule activity</Button></>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'upcoming', label: 'Upcoming', count: db.eduActivities.filter((e) => e.status === 'scheduled').length },
          { value: 'completed', label: 'Completed', count: db.eduActivities.filter((e) => e.status === 'completed').length },
        ]} />
        <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="w-44">
          <option value="all">All categories</option>
          {db.eduCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      {list.length === 0 ? <EmptyState title="No activities" body="Schedule an EDU activity to get started." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <div>
                  <div className="flex items-center gap-2"><Badge tone="teal">{e.categoryId}</Badge><Badge tone={e.status === 'completed' ? 'success' : 'navy'}>{e.status === 'completed' ? 'Completed' : 'Scheduled'}</Badge></div>
                  <CardTitle className="mt-2">{e.title}</CardTitle>
                  <CardDescription>Led by {userName(db, e.coachId)}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
                  <p className="flex items-center gap-2"><Clock className="size-4 text-muted" />{fmtDateTime(e.start)} · {e.durationMin / 60} h</p>
                  <p className="flex items-center gap-2"><MapPin className="size-4 text-muted" />{e.location}</p>
                  <p className="flex items-center gap-2 sm:col-span-2"><Users className="size-4 text-muted" />
                    {e.status === 'completed' ? `${e.attendedIds.length} of ${e.participantIds.length} attended` : `${e.participantIds.length} participating SI leaders`}
                  </p>
                </div>
                <p className="text-sm text-slate-700">{e.description}</p>
                <div className="flex flex-wrap gap-1">
                  {e.participantIds.map((p) => (
                    <span key={p} className={cn('rounded-full px-2 py-0.5 text-xs', e.status === 'completed' ? (e.attendedIds.includes(p) ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger line-through') : 'bg-muted-bg text-slate-600')}>{userName(db, p)}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" onClick={() => { setAttFor(e); setAttSel(e.status === 'completed' ? e.attendedIds : e.participantIds); }}><UserCheck />{e.status === 'completed' ? 'Edit attendance' : 'Register attendance'}</Button>
                  {e.status === 'scheduled' ? (
                    <Button size="sm" variant="ghost" onClick={() => { actions.sendEduReminder(e.id); toast({ title: 'Reminder sent (simulated)', body: `In-app reminder delivered to ${e.participantIds.length} SI leaders.` }); }}><BellRing />Send reminder</Button>
                  ) : null}
                  {e.remindersSent ? <span className="text-xs text-muted">{e.remindersSent} reminder(s) sent</span> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AutomationNote>Completed activities you lead are added to your monthly coaching report; attendance counts towards each SI leader’s EDU participation hours.</AutomationNote>

      <Dialog open={newOpen} onOpenChange={setNewOpen} wide title="Schedule EDU activity" footer={<><Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button onClick={save}>Schedule</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Activity type" htmlFor="edu-cat"><Select id="edu-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{db.eduCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Title" htmlFor="edu-title" error={err.title}><Input id="edu-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. EDU2 — Facilitation techniques" /></Field>
          <Field label="Date" htmlFor="edu-date" error={err.date}><Input id="edu-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="edu-time"><Input id="edu-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
            <Field label="Minutes" htmlFor="edu-dur" error={err.duration}><Input id="edu-dur" type="number" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
          </div>
          <Field label="Location" htmlFor="edu-loc" error={err.location} className="sm:col-span-2"><Input id="edu-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <Field label="Description" htmlFor="edu-desc" className="sm:col-span-2"><Textarea id="edu-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-slate-700">Participating SI leaders</p>
            <div className="flex flex-wrap gap-1.5">
              {leaders.map((l) => {
                const on = f.participants.includes(l.id);
                return <button key={l.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, participants: on ? f.participants.filter((x) => x !== l.id) : [...f.participants, l.id] })} className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'border-teal bg-teal-50 text-teal-700' : 'border-border text-slate-600')}>{l.name}</button>;
              })}
            </div>
            {err.participants ? <p className="mt-1 text-xs text-danger">{err.participants}</p> : null}
          </div>
        </div>
      </Dialog>

      <Dialog open={!!attFor} onOpenChange={(o) => !o && setAttFor(null)} title="Register attendance" description={attFor?.title} footer={<>
        <Button variant="outline" onClick={() => setAttFor(null)}>Cancel</Button>
        <Button onClick={() => { actions.saveEdu({ ...attFor!, attendedIds: attSel, status: 'completed' }); setAttFor(null); toast({ title: 'Attendance registered', body: 'Activity marked as completed.' }); }}>Save & mark completed</Button></>}>
        <div className="space-y-1.5">
          {attFor?.participantIds.map((p) => {
            const on = attSel.includes(p);
            return (
              <label key={p} className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted-bg/50">
                {userName(db, p)}
                <input type="checkbox" className="size-4 accent-teal" checked={on} onChange={() => setAttSel(on ? attSel.filter((x) => x !== p) : [...attSel, p])} />
              </label>
            );
          })}
        </div>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen} title="Activity categories" description="EDU1 and EDU2 are configurable categories, not fixed procedures." footer={<>
        <Button variant="outline" onClick={() => setCatOpen(false)}>Close</Button>
        <Button disabled={catName.trim().length < 2} onClick={() => { actions.addEduCategory(catName, catDesc); setCatName(''); setCatDesc(''); toast({ title: 'Category added' }); }}><Plus />Add category</Button></>}>
        <div className="space-y-2">
          {db.eduCategories.map((c) => <div key={c.id} className="rounded-lg border border-border px-3 py-2 text-sm"><span className="font-medium text-navy">{c.name}</span> <span className="text-muted">— {c.description}</span></div>)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="New category name" htmlFor="cat-name"><Input id="cat-name" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. EDU3" /></Field>
          <Field label="Description" htmlFor="cat-desc"><Input id="cat-desc" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} /></Field>
        </div>
      </Dialog>
    </div>
  );
}
