import { useEffect, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { useStore } from '@/data/store';
import { courseName, userName } from '@/data/calc';
import type { Observation } from '@/data/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { ObservationBadge, AutomationNote } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { format } from 'date-fns';

export function ObservationForm({ obs, onClose }: { obs: Observation | null; onClose: () => void }) {
  const { db, actions } = useStore();
  const toast = useToast();
  const [f, setF] = useState<Observation | null>(obs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { setF(obs ? { ...obs, date: obs.date ?? format(new Date(), 'yyyy-MM-dd') } : null); setErrors({}); }, [obs]);
  if (!f) return null;
  const readOnly = obs?.status === 'completed';
  const set = (k: keyof Observation, v: string | number) => setF({ ...f, [k]: v });

  const complete = () => {
    const e: Record<string, string> = {};
    if (!f.date) e.date = 'Observation date is required.';
    if (f.attendees === undefined || f.attendees === null || Number.isNaN(f.attendees) || f.attendees < 0) e.attendees = 'Enter the number of attending students.';
    if (f.description.trim().length < 5) e.description = 'Describe the session briefly.';
    if (f.wentWell.trim().length < 5) e.wentWell = 'Required to complete the observation.';
    if (f.improve.trim().length < 5) e.improve = 'Required to complete the observation.';
    setErrors(e);
    if (Object.keys(e).length) return;
    actions.saveObservation(f, true);
    toast({ title: 'Observation completed', body: `Added to ${userName(db, f.leaderId)}'s coaching record and your monthly report.` });
    onClose();
  };

  return (
    <Dialog
      open={!!obs}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={`Observation ${f.number} — ${userName(db, f.leaderId)}`}
      description={`${courseName(db, f.courseId)} · Period ${f.period}`}
      footer={readOnly ? <Button variant="outline" onClick={onClose}>Close</Button> : <>
        <Button variant="outline" onClick={() => { actions.saveObservation(f, false); toast({ title: 'Draft saved' }); onClose(); }}><Save />Save Draft</Button>
        <Button variant="success" onClick={complete}><CheckCircle2 />Complete Observation</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2"><ObservationBadge status={f.status} /></div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="SI leader" htmlFor="ob-leader"><Input id="ob-leader" value={userName(db, f.leaderId)} disabled /></Field>
          <Field label="Course" htmlFor="ob-course"><Input id="ob-course" value={courseName(db, f.courseId)} disabled /></Field>
          <Field label="Observation date" htmlFor="ob-date" error={errors.date}><Input id="ob-date" type="date" value={f.date ?? ''} onChange={(e) => set('date', e.target.value)} disabled={readOnly} /></Field>
          <Field label="Attending students" htmlFor="ob-att" error={errors.attendees}><Input id="ob-att" type="number" min={0} value={f.attendees ?? ''} onChange={(e) => set('attendees', e.target.value === '' ? NaN : Number(e.target.value))} disabled={readOnly} /></Field>
        </div>
        <Field label="Session description" htmlFor="ob-desc" error={errors.description}><Textarea id="ob-desc" value={f.description} onChange={(e) => set('description', e.target.value)} disabled={readOnly} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What went well" htmlFor="ob-well" error={errors.wentWell}><Textarea id="ob-well" value={f.wentWell} onChange={(e) => set('wentWell', e.target.value)} disabled={readOnly} /></Field>
          <Field label="What could improve" htmlFor="ob-imp" error={errors.improve}><Textarea id="ob-imp" value={f.improve} onChange={(e) => set('improve', e.target.value)} disabled={readOnly} /></Field>
          <Field label="Recommendations" htmlFor="ob-rec"><Textarea id="ob-rec" value={f.recommendations} onChange={(e) => set('recommendations', e.target.value)} disabled={readOnly} /></Field>
          <Field label="Coach reflections" htmlFor="ob-ref"><Textarea id="ob-ref" value={f.reflections} onChange={(e) => set('reflections', e.target.value)} disabled={readOnly} /></Field>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => setF({
              ...f,
              attendees: f.attendees && !Number.isNaN(f.attendees) ? f.attendees : 12,
              description: f.description || 'Exam-style problems on integration, solved in groups of three with a summary round on the whiteboard.',
              wentWell: f.wentWell || 'Excellent use of redirecting questions; students explained solutions to each other.',
              improve: f.improve || 'The final summary was rushed. Plan 10 minutes for it.',
              recommendations: f.recommendations || 'Use a visible timer and let groups present one solution each.',
              reflections: f.reflections || 'Clear progress since Observation 1. Discuss time management in the next coaching meeting.',
            })}>Fill example text (demo)</Button>
            <span className="text-xs text-muted">Helpful during live presentations.</span>
          </div>
        ) : null}
        <AutomationNote>Completing an observation updates the coach dashboard, the SI leader’s coaching record and the coach’s monthly report.</AutomationNote>
      </div>
    </Dialog>
  );
}
