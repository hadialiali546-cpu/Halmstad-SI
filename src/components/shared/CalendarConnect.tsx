import { useMemo, useState } from 'react';
import { CalendarArrowDown, CalendarCheck2, Loader2, Mail, Globe, Apple, Link2, Download, RefreshCw, Unplug, Copy, Check, ShieldCheck } from 'lucide-react';
import { useStore, PROVIDER_LABEL } from '@/data/store';
import type { CalendarProvider } from '@/data/types';
import { useMe } from '@/lib/hooks';
import { calendarEvents } from '@/lib/calendar';
import { downloadCalendar } from '@/lib/files';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AutomationNote } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, fmtDateTime, fmtDay, fmtTime } from '@/lib/utils';

const PROVIDERS: { id: CalendarProvider; icon: typeof Mail; hint: string }[] = [
  { id: 'outlook', icon: Mail, hint: 'Recommended — university Microsoft 365 account' },
  { id: 'google', icon: Globe, hint: 'Personal Google account' },
  { id: 'apple', icon: Apple, hint: 'iPhone, iPad and Mac' },
  { id: 'ics', icon: Link2, hint: 'Any calendar app that supports subscriptions' },
];

const KIND_LABEL = { session: 'SI session', edu: 'EDU', observation: 'Observation' } as const;

/** "Connect your calendar" for students, SI leaders and SI coaches. The connection is simulated;
 *  the .ics file is real and contains the person's upcoming events. */
export function CalendarConnect({ variant }: { variant: 'header' | 'banner' }) {
  const { db, actions, now } = useStore();
  const { id, role, user } = useMe();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState<CalendarProvider | null>(null);
  const [copied, setCopied] = useState(false);
  const conn = db.calendarConnections.find((c) => c.userId === id);
  const include = conn?.include ?? { sessions: true, edu: true, observations: true };
  const events = useMemo(() => calendarEvents(db, id, role, include, now), [db, id, role, include, now]);

  if (role === 'supervisor') return null;

  const connect = (p: CalendarProvider) => {
    setConnecting(p);
    setTimeout(() => {
      actions.connectCalendar(id, p, events.length);
      setConnecting(null);
      toast({ title: 'Calendar connected', body: `${events.length} upcoming event(s) synced to ${PROVIDER_LABEL[p]} (simulated).` });
    }, 900);
  };
  const download = () => {
    downloadCalendar(events, `Halmstad SI — ${user.name}`, `halmstad-si-${user.name.split(' ')[0].toLowerCase()}.ics`);
    toast({ title: 'Calendar file downloaded', body: `${events.length} event(s). Open the .ics file to import them.` });
  };
  const feedUrl = `webcal://demo.halmstad-si.example/calendar/${id}.ics`;

  const trigger = variant === 'header' ? (
    <button
      onClick={() => setOpen(true)}
      className={cn('relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium', conn ? 'border-success/40 bg-success-bg text-success' : 'border-border bg-white text-navy hover:bg-muted-bg')}
      aria-label={conn ? 'Calendar connected — manage' : 'Connect your calendar'}
      title={conn ? `Synced with ${PROVIDER_LABEL[conn.provider]}` : 'Connect your calendar'}
    >
      {conn ? <CalendarCheck2 className="size-4" /> : <CalendarArrowDown className="size-4" />}
      <span className="hidden xl:inline">{conn ? 'Calendar synced' : 'Connect calendar'}</span>
    </button>
  ) : (
    <div className={cn('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center', conn ? 'border-success/30 bg-success-bg/50' : 'border-teal-100 bg-teal-50/60')}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', conn ? 'bg-white text-success' : 'bg-white text-teal-700')}>
        {conn ? <CalendarCheck2 className="size-5" /> : <CalendarArrowDown className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">{conn ? `Your calendar is connected — ${PROVIDER_LABEL[conn.provider]}` : 'Connect your calendar'}</p>
        <p className="text-sm text-slate-600">
          {conn
            ? `${events.length} upcoming event(s) are kept in sync. Changes and cancellations update automatically.`
            : `Get ${role === 'student' ? 'SI sessions for your courses' : role === 'leader' ? 'your SI sessions, EDU activities and observations' : 'observations and EDU activities'} straight into Outlook, Google or Apple Calendar.`}
        </p>
      </div>
      <Button variant={conn ? 'outline' : 'teal'} onClick={() => setOpen(true)}>{conn ? 'Manage' : <><CalendarArrowDown />Connect your calendar</>}</Button>
    </div>
  );

  return (
    <>
      {trigger}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        wide
        title={conn ? 'Calendar connection' : 'Connect your calendar'}
        description={conn ? `Connected to ${PROVIDER_LABEL[conn.provider]} · last synced ${fmtDateTime(conn.lastSyncAt)}` : 'Choose where your SI events should appear.'}
        footer={conn ? <>
          <Button variant="ghost" onClick={() => { actions.disconnectCalendar(id); toast({ title: 'Calendar disconnected', tone: 'info' }); }}><Unplug />Disconnect</Button>
          <Button variant="outline" onClick={download}><Download />Download .ics</Button>
          <Button onClick={() => { actions.syncCalendar(id); toast({ title: 'Calendar synced', body: `${events.length} event(s) up to date.` }); }}><RefreshCw />Sync now</Button>
        </> : <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>}
      >
        {!conn ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  disabled={!!connecting}
                  onClick={() => connect(p.id)}
                  className="flex items-center gap-3 rounded-xl border border-border p-4 text-left transition hover:border-teal-200 hover:bg-teal-50/40 disabled:opacity-60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy">
                    {connecting === p.id ? <Loader2 className="size-5 animate-spin" /> : <p.icon className="size-5" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-navy">{PROVIDER_LABEL[p.id]}</span>
                    <span className="block text-xs text-muted">{connecting === p.id ? 'Connecting…' : p.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-canvas p-3 text-sm">
              <p className="font-medium text-navy">{events.length} upcoming event(s) will be added</p>
              <p className="text-muted">Sessions, rescheduling and cancellations stay in sync automatically.</p>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Simulated connection in this demo. In production this would use university SSO consent with Microsoft Graph / Google Calendar APIs, or a personal subscription link. You can still download a real .ics file below.</p>
            <Button variant="link" onClick={download}><Download className="mr-1" />Download upcoming events as .ics instead</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-navy">What to sync</p>
              <div className="flex flex-wrap gap-2">
                {(role === 'student' ? (['sessions'] as const) : (['sessions', 'edu', 'observations'] as const))
                  .filter((k) => !(role === 'coach' && k === 'sessions'))
                  .map((k) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <input type="checkbox" className="size-4 accent-teal" checked={include[k]} onChange={() => actions.updateCalendar(id, { ...include, [k]: !include[k] })} />
                      {k === 'sessions' ? 'SI sessions' : k === 'edu' ? 'EDU1 / EDU2 activities' : 'Observations'}
                    </label>
                  ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-navy">Upcoming synced events ({events.length})</p>
              <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {events.slice(0, 12).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-36 shrink-0 whitespace-nowrap text-muted">{fmtDay(e.start)}, {fmtTime(e.start)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{e.title}</span>
                    <Badge tone={e.kind === 'session' ? 'navy' : e.kind === 'edu' ? 'teal' : 'warning'}>{KIND_LABEL[e.kind]}</Badge>
                  </div>
                ))}
                {!events.length ? <p className="p-4 text-center text-sm text-muted">No upcoming events.</p> : null}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-navy">Subscription link</p>
              <div className="flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-canvas px-3 py-2 text-xs text-slate-600">{feedUrl}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(feedUrl).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted">Demo link — not a live feed. Use “Download .ics” for a real file.</p>
            </div>
            <AutomationNote>When a session is added, moved or cancelled, connected calendars update automatically — no manual copying of schedules.</AutomationNote>
          </div>
        )}
      </Dialog>
    </>
  );
}
