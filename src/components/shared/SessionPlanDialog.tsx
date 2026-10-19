import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Paperclip, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { useStore } from '@/data/store';
import { courseName } from '@/data/calc';
import type { Material, SessionPlan } from '@/data/types';
import { PLAN_TEMPLATES } from '@/lib/templates';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { AutomationNote } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, fmtDay, fmtTime } from '@/lib/utils';

const MAX_FILE = 700_000; // kept inside the session record (Firestore documents max 1 MB); Cloud Storage later

const emptyPlan = (): SessionPlan => ({ goals: '', activities: [], notes: '', updatedAt: '' });
const fmtSize = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} kB`);

export function SessionPlanDialog({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const { db, actions } = useStore();
  const toast = useToast();
  const s = db.sessions.find((x) => x.id === sessionId);
  const [plan, setPlan] = useState<SessionPlan>(emptyPlan());
  const [materials, setMaterials] = useState<Material[]>([]);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!s) return;
    setPlan(s.plan ? structuredClone(s.plan) : emptyPlan());
    setMaterials(s.materials ?? []);
    setErr('');
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;
  const total = plan.activities.reduce((n, a) => n + (Number(a.minutes) || 0), 0);
  const over = total > s.durationMin;

  const applyTemplate = (id: string) => {
    const t = PLAN_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    // scale template minutes to the session length
    const tTotal = t.activities.reduce((n, a) => n + a.minutes, 0);
    const k = s.durationMin / tTotal;
    setPlan({ ...plan, templateId: t.id, goals: plan.goals || t.goals, activities: t.activities.map((a, i) => ({ id: `pa-${Date.now()}-${i}`, title: a.title, minutes: Math.max(5, Math.round((a.minutes * k) / 5) * 5) })) });
  };
  const setAct = (i: number, patch: Partial<SessionPlan['activities'][number]>) => setPlan({ ...plan, activities: plan.activities.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const move = (i: number, d: -1 | 1) => {
    const a = [...plan.activities];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setPlan({ ...plan, activities: a });
  };
  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (f.size > MAX_FILE) { setErr(`${f.name} is larger than 700 kB (pilot limit until file storage is added).`); return; }
      const reader = new FileReader();
      reader.onload = () => setMaterials((m) => [...m, { id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: f.name, size: f.size, mime: f.type || 'application/octet-stream', dataUrl: String(reader.result), uploadedAt: new Date().toISOString() }]);
      reader.readAsDataURL(f);
    });
    if (fileRef.current) fileRef.current.value = '';
  };
  const save = () => {
    if (plan.activities.some((a) => !a.title.trim())) return setErr('Every activity needs a title.');
    const hasPlan = plan.goals.trim() || plan.activities.length || plan.notes.trim();
    try {
      actions.saveSessionPlan(s.id, hasPlan ? plan : undefined, materials);
    } catch {
      return setErr('Could not save — browser storage may be full. Remove large files.');
    }
    toast({ title: 'Session plan saved', body: materials.length ? 'Students can see and download the materials.' : undefined });
    onClose();
  };

  return (
    <Dialog
      open={!!sessionId}
      onOpenChange={(o) => !o && onClose()}
      wide
      title="Session plan"
      description={`${courseName(db, s.courseId)} · ${fmtDay(s.start)}, ${fmtTime(s.start)} · ${s.durationMin} min · ${s.topic}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save plan</Button></>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Start from template" htmlFor="plan-tpl" className="sm:col-span-1">
            <Select id="plan-tpl" value={plan.templateId ?? ''} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Choose a template…</option>
              {PLAN_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Learning goal" htmlFor="plan-goals" className="sm:col-span-2">
            <Input id="plan-goals" value={plan.goals} onChange={(e) => setPlan({ ...plan, goals: e.target.value })} placeholder="What should students be able to do after the session?" />
          </Field>
        </div>
        {plan.templateId ? <p className="-mt-3 text-xs text-muted">{PLAN_TEMPLATES.find((t) => t.id === plan.templateId)?.description} Times scaled to {s.durationMin} min.</p> : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">Activities</p>
            <p className={cn('text-sm tabular-nums', over ? 'font-medium text-danger' : 'text-muted')}>{total} / {s.durationMin} min</p>
          </div>
          <div className="space-y-2">
            {plan.activities.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <span className="w-5 text-right text-sm text-muted">{i + 1}.</span>
                <Input aria-label={`Activity ${i + 1}`} value={a.title} onChange={(e) => setAct(i, { title: e.target.value })} className="flex-1" />
                <Input aria-label={`Minutes for activity ${i + 1}`} type="number" min={0} step={5} value={a.minutes} onChange={(e) => setAct(i, { minutes: Number(e.target.value) })} className="w-20" />
                <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp /></Button>
                <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown /></Button>
                <Button size="icon" variant="ghost" aria-label="Remove activity" onClick={() => setPlan({ ...plan, activities: plan.activities.filter((_, j) => j !== i) })}><Trash2 /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setPlan({ ...plan, activities: [...plan.activities, { id: `pa-${Date.now()}`, title: '', minutes: 10 }] })}><Plus />Add activity</Button>
          </div>
          {over ? <p className="mt-1 text-xs text-danger">The plan is longer than the session.</p> : null}
        </div>

        <Field label="Notes for yourself" htmlFor="plan-notes">
          <Textarea id="plan-notes" value={plan.notes} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} rows={2} className="min-h-[60px]" placeholder="Things to bring, questions to ask…" />
        </Field>

        <div>
          <p className="mb-2 text-sm font-semibold text-navy">Materials for students</p>
          <div className="space-y-1.5">
            {materials.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <FileText className="size-4 text-muted" /><span className="flex-1 truncate">{m.name}</span><span className="text-xs text-muted">{fmtSize(m.size)}</span>
                <Button size="icon" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => setMaterials(materials.filter((x) => x.id !== m.id))}><Trash2 /></Button>
              </div>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-teal hover:bg-teal-50/50">
              <Paperclip className="size-4" />Attach files (exercise sheets, slides…)
              <input ref={fileRef} type="file" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
            </label>
          </div>
        </div>
        {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
        <AutomationNote>Students see the learning goal and can download materials from their session card.</AutomationNote>
      </div>
    </Dialog>
  );
}
