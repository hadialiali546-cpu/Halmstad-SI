import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, LogOut, MailCheck, Hourglass, Database, ShieldCheck, Laptop } from 'lucide-react';
import { authErrorText, useIdentity } from '@/backend/identity';
import { chooseOffline } from '@/backend/firebase';
import logoUrl from '@/assets/brand/si-logo-full.webp';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Tabs } from '@/components/ui/misc';
import { useT } from '@/lib/i18n';

function Frame({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-white via-[#F3F8FD] to-[#E6F1FB]">
      <div className="pointer-events-none absolute -right-32 -top-32 size-[460px] rounded-full bg-[#5BB8F2]/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[420px] rounded-full bg-[#0B3D73]/10 blur-3xl" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <img src={logoUrl} alt="SI Halmstad University, Supplemental Instruction" className="mx-auto w-48 sm:w-64" />
        <div className="mb-6 mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
          <p className="text-center text-sm font-medium text-[#0B3D73]">{t('One Platform. Less Administration. More Learning.')}</p>
          <span className="rounded-full bg-[#0B3D73]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0B3D73]">Pilot</span>
        </div>
        <div className="rounded-2xl border border-[#D6E6F5] bg-white p-6 shadow-xl shadow-[#0B3D73]/5">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-500">Halmstad SI pilot · data stored in Firebase (EU, Stockholm).</p>
      </div>
    </div>
  );
}

export function FullScreenLoader({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex items-center gap-3 text-sm text-muted"><Loader2 className="size-5 animate-spin text-teal" />{text}</div>
    </div>
  );
}

const offlineDemo = () => { chooseOffline(true); window.location.reload(); };

export function LoginScreen() {
  const { signIn, signUp, resetPassword } = useIdentity();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(''); setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
    if (tab === 'up') {
      if (name.trim().length < 2) return setErr('Enter your name.');
      if (password.length < 8) return setErr('Use at least 8 characters for the password.');
      if (!agree) return setErr('Please accept the privacy notice.');
    }
    setBusy(true);
    try {
      if (tab === 'in') await signIn(email, password);
      else await signUp(name, email, password);
    } catch (ex) {
      setErr(authErrorText((ex as { code?: string }).code ?? ''));
    } finally { setBusy(false); }
  };

  return (
    <Frame>
      <h1 className="text-xl font-semibold text-navy">{tab === 'in' ? 'Sign in' : 'Create account'}</h1>
      <p className="mt-1 text-sm text-muted">{tab === 'in' ? 'Welcome back to Halmstad SI.' : 'An SI supervisor approves new accounts and assigns your role.'}</p>
      <div className="mt-4"><Tabs value={tab} onChange={(v) => { setTab(v); setErr(''); setInfo(''); }} items={[{ value: 'in', label: 'Sign in' }, { value: 'up', label: 'Create account' }]} /></div>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        {tab === 'up' ? <Field label="Full name" htmlFor="au-name"><Input id="au-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field> : null}
        <Field label="Email" htmlFor="au-email"><Input id="au-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        <Field label="Password" htmlFor="au-pw" hint={tab === 'up' ? 'At least 8 characters' : undefined}><Input id="au-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} /></Field>
        {tab === 'up' ? (
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" className="mt-0.5 size-4 accent-teal" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I understand that my name, email and SI activity (attendance, feedback, reported grades) are stored to run the SI programme, in Firebase in the EU (Stockholm). I can ask an SI supervisor to export or delete my data.
          </label>
        ) : null}
        {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
        {info ? <p className="text-sm text-success" role="status">{info}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null}{tab === 'in' ? 'Sign in' : 'Create account'}</Button>
        {tab === 'in' ? (
          <button type="button" className="w-full text-center text-sm text-teal hover:underline" onClick={async () => {
            setErr(''); setInfo('');
            if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter your email above first.');
            try { await resetPassword(email); setInfo('Password reset email sent (check spam).'); } catch (ex) { setErr(authErrorText((ex as { code?: string }).code ?? '')); }
          }}>Forgot password?</button>
        ) : null}
      </form>
      <div className="mt-6 border-t border-border pt-4">
        <button onClick={offlineDemo} className="flex w-full items-center justify-center gap-2 text-sm text-muted hover:text-navy"><Laptop className="size-4" />Explore the offline demo instead (fictional data, stays in this browser)</button>
      </div>
    </Frame>
  );
}

export function VerifyEmailScreen() {
  const { user, resendVerification, signOut } = useIdentity();
  const [sent, setSent] = useState(false);
  return (
    <Frame>
      <MailCheck className="size-8 text-teal" />
      <h1 className="mt-3 text-xl font-semibold text-navy">Verify your email</h1>
      <p className="mt-2 text-sm text-slate-600">{user?.email} is registered as the first SI supervisor. For security, open the verification link we emailed you, then reload this page.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => window.location.reload()}>I’ve verified — reload</Button>
        <Button variant="outline" disabled={sent} onClick={async () => { await resendVerification(); setSent(true); }}>{sent ? 'Email sent' : 'Resend email'}</Button>
        <Button variant="ghost" onClick={signOut}><LogOut />Sign out</Button>
      </div>
    </Frame>
  );
}

export function PendingScreen() {
  const { user, profile, signOut } = useIdentity();
  return (
    <Frame>
      <Hourglass className="size-8 text-teal" />
      <h1 className="mt-3 text-xl font-semibold text-navy">Waiting for approval</h1>
      <p className="mt-2 text-sm text-slate-600">Hi {profile?.name ?? user?.displayName ?? ''}! Your account ({user?.email}) has been created. An SI supervisor will assign your role (student, SI leader or SI coach). This page updates automatically.</p>
      {!profile ? <p className="mt-2 text-xs text-warning">Your profile could not be created. Check that Firestore is set up, then reload.</p> : null}
      <div className="mt-5 flex gap-2">
        <Button variant="outline" onClick={offlineDemo}><Laptop />Try the offline demo</Button>
        <Button variant="ghost" onClick={signOut}><LogOut />Sign out</Button>
      </div>
    </Frame>
  );
}

export function EmptyDbScreen({ seed, isSupervisor }: { seed: () => Promise<void>; isSupervisor: boolean }) {
  const { signOut } = useIdentity();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Frame>
      <Database className="size-8 text-teal" />
      <h1 className="mt-3 text-xl font-semibold text-navy">The database is empty</h1>
      {isSupervisor ? (
        <>
          <p className="mt-2 text-sm text-slate-600">Load the fictional demo dataset (4 courses, 8 SI leaders, 30 students, three months of sessions) into Firestore. Everyone who signs in will share it in real time.</p>
          {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
          <div className="mt-5 flex gap-2">
            <Button disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await seed(); } catch (e) { setErr(String((e as Error).message)); setBusy(false); } }}>
              {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}Load demo data
            </Button>
            <Button variant="ghost" onClick={signOut}><LogOut />Sign out</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">An SI supervisor needs to set up the data first. Please check back later.</p>
          <Button className="mt-5" variant="ghost" onClick={signOut}><LogOut />Sign out</Button>
        </>
      )}
    </Frame>
  );
}
