import { useState, type FormEvent } from 'react';
import { QrCode, Star, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/data/store';
import { courseName, feedbackDue, openCheckins, userName } from '@/data/calc';
import type { SISession } from '@/data/types';
import { useMe } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn, fmtDay, fmtTime } from '@/lib/utils';

/** Card shown to students while an SI session they can join has check-in open */
export function CheckinCard({ presetCode }: { presetCode?: string }) {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const open = openCheckins(db, id);
  const [code, setCode] = useState(presetCode ?? '');
  const [err, setErr] = useState('');
  if (!open.length) return null;
  const s = open[0];
  const done = s.checkin!.studentIds.includes(id);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = actions.checkIn(db, s.id, id, code);
    if (res) return setErr(res);
    setErr('');
    toast({ title: 'You are checked in', body: `${courseName(db, s.courseId)} — enjoy the session!` });
  };
  return (
    <div className={cn('rounded-xl border p-4', done ? 'border-success/30 bg-success-bg/60' : 'border-teal bg-teal-50/70')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-teal-700">{done ? <CheckCircle2 className="size-6 text-success" /> : <QrCode className="size-6" />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">{done ? 'You are checked in' : 'Check-in is open'}</p>
          <p className="text-sm text-slate-600">{courseName(db, s.courseId)} with {userName(db, s.leaderId)} · {fmtDay(s.start)}, {fmtTime(s.start)} · {s.location}</p>
        </div>
        {!done ? (
          <form onSubmit={submit} className="flex items-start gap-2">
            <div>
              <Input aria-label="Check-in code" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr(''); }} placeholder="4-digit code" inputMode="numeric" className="w-32 text-center font-mono text-lg tracking-widest" />
            </div>
            <Button type="submit" variant="teal" disabled={code.length !== 4}>Check in</Button>
          </form>
        ) : null}
      </div>
      {err ? <p className="mt-2 text-sm text-danger" role="alert">{err}</p> : null}
      {!done ? <p className="mt-2 text-xs text-muted">Scan the QR code shown by your SI leader, or type the code.</p> : null}
    </div>
  );
}

export function FeedbackDialog({ session, onClose }: { session: SISession | null; onClose: () => void }) {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [helpful, setHelpful] = useState<'yes' | 'partly' | 'no' | ''>('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  if (!session) return null;
  const submit = () => {
    if (!rating) return setErr('Choose a rating from 1 to 5.');
    if (!helpful) return setErr('Tell us if the session helped with your course.');
    actions.submitFeedback({ sessionId: session.id, studentId: id, rating, helpful, comment: comment.trim() });
    toast({ title: 'Thanks for your feedback!', body: 'It is shared anonymously with your SI leader.' });
    setRating(0); setHelpful(''); setComment(''); setErr('');
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="How was the SI session?" description={`${courseName(db, session.courseId)} · ${fmtDay(session.start)} · ${session.topic}`}
      footer={<><Button variant="outline" onClick={onClose}>Later</Button><Button variant="teal" onClick={submit}>Send feedback</Button></>}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-700">Overall rating</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} of 5`} onClick={() => { setRating(n); setErr(''); }} className="rounded p-1">
                <Star className={cn('size-8', n <= rating ? 'fill-[#E0A23B] text-[#E0A23B]' : 'text-slate-300')} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-700">Did it help you with the course?</p>
          <div className="flex gap-2">
            {(['yes', 'partly', 'no'] as const).map((h) => (
              <button key={h} onClick={() => { setHelpful(h); setErr(''); }} aria-pressed={helpful === h} className={cn('rounded-lg border px-4 py-1.5 text-sm capitalize', helpful === h ? 'border-teal bg-teal-50 text-teal-700' : 'border-border')}>{h}</button>
            ))}
          </div>
        </div>
        <Field label="Comment (optional, anonymous)" htmlFor="fb-comment"><Textarea id="fb-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="min-h-[60px]" /></Field>
        {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
      </div>
    </Dialog>
  );
}

/** List of recent sessions waiting for the student's rating */
export function FeedbackDueCard() {
  const { db, now } = useStore();
  const { id } = useMe();
  const [sel, setSel] = useState<SISession | null>(null);
  const due = feedbackDue(db, id, now);
  if (!due.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-card">
      <p className="flex items-center gap-2 font-semibold text-navy"><Star className="size-4 text-[#E0A23B]" />Rate your recent sessions</p>
      <div className="mt-2 space-y-2">
        {due.slice(0, 3).map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{courseName(db, s.courseId)} · {fmtDay(s.start)}</span>
            <Button size="sm" variant="outline" onClick={() => setSel(s)}>Rate</Button>
          </div>
        ))}
      </div>
      <FeedbackDialog session={sel} onClose={() => setSel(null)} />
    </div>
  );
}
