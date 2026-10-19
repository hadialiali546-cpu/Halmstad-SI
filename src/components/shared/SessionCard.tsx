import { CalendarPlus, MapPin, Clock, User, Lightbulb, Target, FileDown } from 'lucide-react';
import { addMinutes, parseISO } from 'date-fns';
import type { SISession } from '@/data/types';
import { useStore } from '@/data/store';
import { courseById, userName } from '@/data/calc';
import { downloadICS } from '@/lib/files';
import { fmtDay, fmtTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { useT } from '@/lib/i18n';

export function SessionCard({ s, compact }: { s: SISession; compact?: boolean }) {
  const { db } = useStore();
  const { t } = useT();
  const toast = useToast();
  const course = courseById(db, s.courseId)!;
  const start = parseISO(s.start);
  return (
    <div className="flex flex-col rounded-xl border border-border bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-teal-700">{course.code}</p>
          <p className="font-semibold text-navy">{course.name}</p>
        </div>
        <div className="rounded-lg bg-navy-50 px-2.5 py-1 text-center">
          <p className="text-[10px] font-semibold uppercase text-navy/70">{fmtDay(s.start).split(' ')[0]}</p>
          <p className="text-sm font-semibold leading-tight text-navy">{fmtDay(s.start).split(' ').slice(1).join(' ')}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-center gap-2"><Clock className="size-4 text-muted" />{fmtTime(start)}–{fmtTime(addMinutes(start, s.durationMin))}</p>
        <p className="flex items-center gap-2"><MapPin className="size-4 text-muted" />{s.location}</p>
        <p className="flex items-center gap-2"><User className="size-4 text-muted" />{userName(db, s.leaderId)}</p>
        {!compact ? <p className="flex items-start gap-2"><Lightbulb className="mt-0.5 size-4 shrink-0 text-muted" /><span>Suggested topic: <span className="font-medium text-slate-800">{s.topic}</span></span></p> : null}
        {!compact && s.plan?.goals ? <p className="flex items-start gap-2"><Target className="mt-0.5 size-4 shrink-0 text-muted" /><span>Goal: {s.plan.goals}</span></p> : null}
      </div>
      {s.materials?.length ? (
        <div className="mt-3 space-y-1">
          {s.materials.map((m) => (
            <a key={m.id} href={m.dataUrl} download={m.name} className="flex items-center gap-2 rounded-lg bg-teal-50/70 px-2.5 py-1.5 text-sm text-teal-700 hover:bg-teal-50"><FileDown className="size-4" />{m.name}</a>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-2">
        {s.source === 'leader' ? <Badge tone="teal">New</Badge> : <span />}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            downloadICS({ id: s.id, title: `SI: ${course.name}`, start: s.start, durationMin: s.durationMin, location: s.location, description: `SI session with ${userName(db, s.leaderId)}. Topic: ${s.topic}` });
            toast({ title: 'Calendar file downloaded', body: 'Open the .ics file to add the session to your calendar.' });
          }}
        >
          <CalendarPlus />{t('Add to Calendar')}
        </Button>
      </div>
    </div>
  );
}
