import { useState } from 'react';
import { Plus, Send, Trash2, BarChart3, Users, Wand2, Lock } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/data/store';
import { userName } from '@/data/calc';
import type { QuestionType, Survey, SurveyQuestion } from '@/data/types';
import { useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { PageHeader, Progress, EmptyState, AutomationNote } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/utils';

const targetLabel = { my_leaders: 'My SI leaders', all_leaders: 'All SI leaders', students: 'All students' } as const;

export function CoachSurveys() {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const surveys = db.surveys.filter((s) => s.coachId === id || s.targetGroup === 'all_leaders');
  const [selId, setSelId] = useState(surveys[0]?.id ?? '');
  const sel = db.surveys.find((s) => s.id === selId);
  const [builder, setBuilder] = useState<Survey | null>(null);
  const [err, setErr] = useState('');

  const newSurvey = (): Survey => ({
    id: `srv-${Date.now()}`, title: '', coachId: id, targetGroup: 'my_leaders', status: 'draft', createdAt: new Date().toISOString(),
    recipientIds: [], responses: [], questions: [{ id: 'q1', type: 'rating', text: '' }],
  });

  const saveBuilder = (send: boolean) => {
    if (!builder) return;
    if (builder.title.trim().length < 3) return setErr('Give the survey a title.');
    const qs = builder.questions.filter((q) => q.text.trim());
    if (!qs.length) return setErr('Add at least one question.');
    if (qs.some((q) => q.type === 'choice' && (q.options ?? []).filter((o) => o.trim()).length < 2)) return setErr('Multiple-choice questions need at least two options.');
    const s = { ...builder, title: builder.title.trim(), questions: qs.map((q) => ({ ...q, options: q.options?.filter((o) => o.trim()) })) };
    actions.saveSurvey(s);
    if (send) actions.sendSurvey(s.id);
    setSelId(s.id);
    setBuilder(null);
    setErr('');
    toast({ title: send ? 'Survey sent (simulated)' : 'Survey saved as draft', body: send ? 'Recipients received an in-app invitation.' : undefined });
  };

  const setQ = (i: number, q: Partial<SurveyQuestion>) => builder && setBuilder({ ...builder, questions: builder.questions.map((x, j) => (j === i ? { ...x, ...q } : x)) });

  return (
    <div className="space-y-5">
      <PageHeader title="Surveys" description="Lightweight surveys for SI leaders or students, with automatic response statistics." actions={<Button onClick={() => { setBuilder(newSurvey()); setErr(''); }}><Plus />Create survey</Button>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3">
          {surveys.map((s) => (
            <button key={s.id} onClick={() => setSelId(s.id)} className={`w-full rounded-xl border bg-white p-4 text-left shadow-card transition ${selId === s.id ? 'border-teal ring-1 ring-teal' : 'border-border hover:border-teal-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-navy">{s.title}</p>
                <Badge tone={s.status === 'sent' ? 'teal' : s.status === 'closed' ? 'neutral' : 'navy'}>{s.status === 'sent' ? 'Open' : s.status === 'closed' ? 'Closed' : 'Draft'}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{targetLabel[s.targetGroup]} · {s.questions.length} questions · {s.sentAt ? `sent ${fmtDate(s.sentAt)}` : 'not sent'}</p>
              {s.status !== 'draft' ? <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted"><span>Responses</span><span>{s.responses.length}/{s.recipientIds.length}</span></div><Progress value={(s.responses.length / Math.max(1, s.recipientIds.length)) * 100} /></div> : null}
            </button>
          ))}
          {!surveys.length ? <EmptyState title="No surveys yet" /> : null}
        </div>
        <div className="xl:col-span-2">
          {sel ? <SurveyResults s={sel} onEdit={() => { setBuilder(structuredClone(sel)); setErr(''); }} /> : <EmptyState icon={BarChart3} title="Select a survey" />}
        </div>
      </div>

      <Dialog open={!!builder} onOpenChange={(o) => !o && setBuilder(null)} wide title={builder && db.surveys.some((s) => s.id === builder.id) ? 'Edit survey' : 'Create survey'} footer={<>
        <Button variant="outline" onClick={() => setBuilder(null)}>Cancel</Button>
        <Button variant="outline" onClick={() => saveBuilder(false)}>Save draft</Button>
        <Button variant="teal" onClick={() => saveBuilder(true)}><Send />Send invitation</Button></>}>
        {builder ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Title" htmlFor="sv-title" className="sm:col-span-2"><Input id="sv-title" value={builder.title} onChange={(e) => setBuilder({ ...builder, title: e.target.value })} placeholder="e.g. Mid-term check-in" /></Field>
              <Field label="Target group" htmlFor="sv-target"><Select id="sv-target" value={builder.targetGroup} onChange={(e) => setBuilder({ ...builder, targetGroup: e.target.value as Survey['targetGroup'] })}>{Object.entries(targetLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            </div>
            <div className="space-y-3">
              {builder.questions.map((q, i) => (
                <div key={q.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <span className="pt-2 text-sm font-semibold text-muted">{i + 1}.</span>
                    <Input aria-label={`Question ${i + 1}`} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Question text" className="flex-1" />
                    <Select aria-label="Question type" value={q.type} onChange={(e) => setQ(i, { type: e.target.value as QuestionType, options: e.target.value === 'choice' ? (q.options?.length ? q.options : ['', '']) : undefined })} className="sm:w-44">
                      <option value="rating">Rating (1–5)</option><option value="choice">Multiple choice</option><option value="text">Free text</option>
                    </Select>
                    <Button variant="ghost" size="icon" aria-label="Remove question" onClick={() => setBuilder({ ...builder, questions: builder.questions.filter((_, j) => j !== i) })}><Trash2 /></Button>
                  </div>
                  {q.type === 'choice' ? (
                    <div className="mt-2 space-y-1.5 pl-6">
                      {(q.options ?? []).map((o, k) => (
                        <Input key={k} aria-label={`Option ${k + 1}`} value={o} placeholder={`Option ${k + 1}`} onChange={(e) => setQ(i, { options: q.options!.map((x, m) => (m === k ? e.target.value : x)) })} className="h-8" />
                      ))}
                      <Button size="sm" variant="link" onClick={() => setQ(i, { options: [...(q.options ?? []), ''] })}>+ Add option</Button>
                    </div>
                  ) : null}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setBuilder({ ...builder, questions: [...builder.questions, { id: `q${Date.now()}`, type: 'text', text: '' }] })}><Plus />Add question</Button>
            </div>
            {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
            <p className="text-xs text-muted">Invitations are simulated as in-app notifications. No emails are sent.</p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function SurveyResults({ s, onEdit }: { s: Survey; onEdit: () => void }) {
  const { db, actions } = useStore();
  const toast = useToast();
  const rate = s.recipientIds.length ? Math.round((s.responses.length / s.recipientIds.length) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-lg">{s.title}</CardTitle>
          <CardDescription>By {userName(db, s.coachId)} · {targetLabel[s.targetGroup]}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.status === 'draft' ? <><Button size="sm" variant="outline" onClick={onEdit}>Edit</Button><Button size="sm" variant="teal" onClick={() => { actions.sendSurvey(s.id); toast({ title: 'Survey sent (simulated)' }); }}><Send />Send</Button></> : null}
          {s.status === 'sent' ? <>
            <Button size="sm" variant="outline" disabled={s.responses.length >= s.recipientIds.length} onClick={() => { actions.simulateResponses(s.id); toast({ title: 'Simulated responses added', tone: 'info' }); }}><Wand2 />Simulate responses (demo)</Button>
            <Button size="sm" variant="ghost" onClick={() => actions.closeSurvey(s.id)}><Lock />Close</Button>
          </> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {s.status === 'draft' ? <EmptyState title="Draft survey" body="Send the survey to start collecting responses." /> : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-canvas p-3"><p className="text-xs text-muted">Invited</p><p className="text-xl font-semibold text-navy">{s.recipientIds.length}</p></div>
              <div className="rounded-lg bg-canvas p-3"><p className="text-xs text-muted">Responses</p><p className="text-xl font-semibold text-navy">{s.responses.length}</p></div>
              <div className="rounded-lg bg-canvas p-3"><p className="text-xs text-muted">Response rate</p><p className="text-xl font-semibold text-navy">{rate}%</p></div>
            </div>
            {s.questions.map((q, i) => <QuestionResult key={q.id} q={q} i={i} s={s} />)}
            <AutomationNote>Statistics are calculated live from submitted responses.</AutomationNote>
          </>
        )}
        {s.status !== 'draft' && s.recipientIds.length > s.responses.length ? (
          <p className="flex items-center gap-1.5 text-xs text-muted"><Users className="size-3.5" />Awaiting: {s.recipientIds.filter((r) => !s.responses.some((x) => x.respondentId === r)).map((r) => userName(db, r)).slice(0, 6).join(', ')}{s.recipientIds.length - s.responses.length > 6 ? '…' : ''}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function QuestionResult({ q, i, s }: { q: SurveyQuestion; i: number; s: Survey }) {
  const answers = s.responses.map((r) => r.answers[q.id]).filter((a) => a !== undefined && a !== '');
  let body: JSX.Element;
  if (q.type === 'rating') {
    const nums = answers.map(Number);
    const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—';
    const data = [1, 2, 3, 4, 5].map((v) => ({ v: String(v), n: nums.filter((x) => x === v).length }));
    body = (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-lg bg-teal-50 px-4 py-3 text-center"><p className="text-2xl font-semibold text-teal-700">{avg}</p><p className="text-xs text-teal-700">average / 5</p></div>
        <div className="h-32 flex-1">
          <ResponsiveContainer><BarChart data={data}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="v" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} width={24} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v) => [v, 'Responses']} labelFormatter={(l) => `Rating ${l}`} /><Bar dataKey="n" fill="#12304A" radius={[4, 4, 0, 0]} barSize={28} /></BarChart></ResponsiveContainer>
        </div>
      </div>
    );
  } else if (q.type === 'choice') {
    const data = (q.options ?? []).map((o) => ({ o, n: answers.filter((a) => a === o).length }));
    body = (
      <div className="h-40">
        <ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}><CartesianGrid horizontal={false} stroke="#E3E8EE" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="o" width={170} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v) => [v, 'Responses']} /><Bar dataKey="n" fill="#008D95" radius={[0, 4, 4, 0]} barSize={16} /></BarChart></ResponsiveContainer>
      </div>
    );
  } else {
    body = (
      <ul className="space-y-1.5">
        {answers.map((a, k) => <li key={k} className="rounded-lg bg-canvas px-3 py-2 text-sm text-slate-700">“{String(a)}”</li>)}
        {!answers.length ? <li className="text-sm text-muted">No answers yet.</li> : null}
      </ul>
    );
  }
  return (
    <div className="border-t border-border pt-4">
      <p className="mb-2 text-sm font-medium text-navy">{i + 1}. {q.text} <span className="font-normal text-muted">({q.type === 'rating' ? 'rating 1–5' : q.type === 'choice' ? 'multiple choice' : 'free text'} · {answers.length} answers)</span></p>
      {body}
    </div>
  );
}
