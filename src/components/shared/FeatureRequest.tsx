import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Circle, Lightbulb, Send } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { useStore } from '@/data/store';
import { userName } from '@/data/calc';
import { useIdentity } from '@/backend/identity';
import { ROLES } from '@/components/layout/roles';
import { cn } from '@/lib/utils';
import {
  KIND_LABEL, PRIORITY_LABEL, useSubmitRequest, type RequestKind, type RequestPriority,
} from '@/lib/featureRequests';
import type { Role } from '@/data/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ELSEWHERE = 'Whole app / somewhere else';

/** Sidebar button + dialog for feature requests and feedback */
export function FeatureRequestButton({ role, onOpen }: { role: Role; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => { onOpen?.(); setOpen(true); }}
        className="flex w-full items-center gap-3 rounded-lg border border-teal-200/30 bg-teal/15 px-3 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-teal/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
      >
        <Lightbulb className="size-[18px] shrink-0 text-teal-200" aria-hidden />
        <span className="leading-tight">Request a feature<span className="block text-[11px] font-normal text-white/60">or send feedback</span></span>
      </button>
      {open ? <FeatureRequestDialog role={role} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

function FeatureRequestDialog({ role, open, onOpenChange }: { role: Role; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pathname } = useLocation();
  const { db } = useStore();
  const { user, personaFor, backend } = useIdentity();
  const submit = useSubmitRequest();

  const cfg = ROLES[role];
  const areas = useMemo(() => [...cfg.nav.map((n) => `${cfg.label} · ${n.label}`), 'Demo Guide', 'Login & account', ELSEWHERE], [cfg]);
  const current = [...cfg.nav].sort((a, b) => b.to.length - a.to.length).find((n) => pathname === n.to || pathname.startsWith(n.to + '/'));
  const initialArea = pathname.startsWith('/guide') ? 'Demo Guide' : current ? `${cfg.label} · ${current.label}` : ELSEWHERE;

  const [kind, setKind] = useState<RequestKind>('feature');
  const [area, setArea] = useState(initialArea);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('important');
  const [email, setEmail] = useState(user?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const checks = [
    { ok: title.trim().length >= 8, label: 'What you want, in one sentence' },
    { ok: area !== ELSEWHERE, label: 'Where in the app it belongs' },
    { ok: details.trim().length >= 60, label: 'Why it matters or how it should work' },
  ];
  const score = checks.filter((c) => c.ok).length;
  const errors = {
    title: title.trim().length < 8 ? 'Please describe your request in at least a few words.' : '',
    details: details.trim().length < 20 ? 'Please add a little more detail (at least 20 characters).' : '',
    email: !EMAIL_RE.test(email.trim()) ? 'Please enter an email address so we can get back to you.' : '',
  };
  const valid = !errors.title && !errors.details && !errors.email;

  const send = async () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true); setFailed(false);
    try {
      const ref = await submit({
        kind, area, title: title.trim(), details: details.trim(), priority, email: email.trim(), path: pathname, role,
        name: user?.displayName || userName(db, personaFor(role)),
      });
      setDone(ref);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  if (done) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} title="Thank you, request received"
        footer={<Button onClick={() => onOpenChange(false)}>Close</Button>}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success-bg text-success"><CheckCircle2 className="size-7" aria-hidden /></span>
          <p className="mt-3 text-sm text-slate-700">Your reference is <strong className="font-semibold text-navy">{done}</strong>.</p>
          <p className="mt-1 max-w-sm text-sm text-muted">We’ll reply to <strong className="font-medium text-slate-700">{email.trim()}</strong> if we have questions and when it ships.</p>
          {backend?.mode !== 'cloud' ? <p className="mt-3 text-xs text-muted">Offline demo: the request is saved in this browser only. SI supervisors see it under “Feedback inbox”.</p> : null}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request a feature or send feedback"
      description="Tell us what you need and where. We read every request."
      wide
      footer={<>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="teal" onClick={send} disabled={busy}><Send />{busy ? 'Sending…' : 'Send request'}</Button>
      </>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); send(); }} noValidate>
        {/* Clarity guidance */}
        <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3.5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-teal-700">The clearer the request, the faster it can be shipped.</p>
            <span className="shrink-0 text-xs font-medium text-teal-700">Clarity {score}/3</span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < score ? 'bg-teal' : 'bg-teal-100')} />)}
          </div>
          <ul className="mt-2.5 grid gap-1 sm:grid-cols-3">
            {checks.map((c) => (
              <li key={c.label} className={cn('flex items-start gap-1.5 text-xs', c.ok ? 'text-teal-700' : 'text-slate-500')}>
                {c.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden /> : <Circle className="mt-px size-3.5 shrink-0" aria-hidden />}
                <span>{c.label}<span className="sr-only">{c.ok ? ' (done)' : ' (missing)'}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <fieldset>
          <legend className="text-[13px] font-medium text-slate-700">What kind of request is it?</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(KIND_LABEL) as RequestKind[]).map((k) => (
              <label key={k} className={cn('flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-[13px] transition-colors focus-within:ring-2 focus-within:ring-teal/40',
                kind === k ? 'border-teal bg-teal-50 font-medium text-teal-700' : 'border-border text-slate-600 hover:bg-muted-bg')}>
                <input type="radio" name="fr-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {KIND_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where in the app?" htmlFor="fr-area" hint="We pre-selected the page you’re on.">
            <Select id="fr-area" value={area} onChange={(e) => setArea(e.target.value)}>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label="How important is it to you?" htmlFor="fr-priority">
            <Select id="fr-priority" value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)}>
              {(Object.keys(PRIORITY_LABEL) as RequestPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </Select>
          </Field>
        </div>

        <Field label={kind === 'problem' ? 'What went wrong, in one sentence?' : 'What do you want, in one sentence?'} htmlFor="fr-title" error={touched ? errors.title : ''}>
          <Input id="fr-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-invalid={touched && !!errors.title}
            placeholder={kind === 'problem' ? 'e.g. The attendance list doesn’t save on my phone' : 'e.g. Duplicate last week’s session plan'} />
        </Field>

        <Field label="Describe it" htmlFor="fr-details" error={touched ? errors.details : ''}
          hint={kind === 'problem' ? 'What did you do, what happened, and what did you expect?' : 'Who is it for, why does it matter, and how should it work?'}>
          <Textarea id="fr-details" rows={5} value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} aria-invalid={touched && !!errors.details}
            placeholder={kind === 'problem'
              ? '1. I opened …\n2. I clicked …\n3. I expected … but instead …'
              : 'When I … I want to … so that …'} />
        </Field>

        <Field label="Your email" htmlFor="fr-email" error={touched ? errors.email : ''} hint="So we can come back to you with questions or when it’s shipped.">
          <Input id="fr-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!errors.email} placeholder="name@example.com" />
        </Field>

        {failed ? <p className="text-sm text-danger" role="alert">Sending failed. Please check your connection and try again.</p> : null}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
