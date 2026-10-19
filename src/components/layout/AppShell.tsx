import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link, Navigate } from 'react-router-dom';
import { useIdentity } from '@/backend/identity';
import * as Popover from '@radix-ui/react-popover';
import { Bell, ChevronDown, Menu, RotateCcw, X, BookOpenCheck, Check, Languages, LogOut, Cloud } from 'lucide-react';
import { useStore } from '@/data/store';
import { notificationsFor } from '@/data/notifications';
import { userName } from '@/data/calc';
import { useT } from '@/lib/i18n';
import { cn, fmtDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { Logo } from './Logo';
import { CalendarConnect } from '@/components/shared/CalendarConnect';
import { ROLES, ROLE_ORDER } from './roles';
import type { Role } from '@/data/types';

let lastRole: Role = (() => {
  try { return (localStorage.getItem('halmstad-si-role') as Role) || 'student'; } catch { return 'student'; }
})();

/** Role comes from the URL; non-role pages (e.g. the Demo Guide) keep the last used role. */
export function useRole(): Role {
  const { pathname } = useLocation();
  const seg = pathname.split('/')[1] as Role;
  if (ROLE_ORDER.includes(seg)) {
    if (seg !== lastRole) {
      lastRole = seg;
      try { localStorage.setItem('halmstad-si-role', seg); } catch { /* ignore */ }
    }
    return seg;
  }
  return ROLE_ORDER.includes(lastRole) ? lastRole : 'student';
}

export function ConceptBadge({ light }: { light?: boolean }) {
  const { t } = useT();
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', light ? 'bg-white/10 text-teal-200' : 'bg-teal-50 text-teal-700')}>
      {t('Concept Demo')}
    </span>
  );
}

function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const { t } = useT();
  const { mode } = useStore();
  const cfg = ROLES[role];
  return (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Link to="/" onClick={onNavigate}><Logo light /></Link>
      </div>
      <div className="flex gap-1.5 px-5 pb-3"><ConceptBadge light />{mode === 'cloud' ? <span className="inline-flex items-center gap-1 rounded-full bg-success/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"><Cloud className="size-3" />Live</span> : null}</div>
      <p className="px-5 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{t(cfg.label)}</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main navigation">
        {cfg.nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', isActive ? 'bg-white/10 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')
            }
          >
            {({ isActive }) => (
              <>
                <n.icon className={cn('size-[18px]', isActive ? 'text-teal-200' : '')} />
                {t(n.label)}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <NavLink to="/guide" onClick={onNavigate} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
          <BookOpenCheck className="size-[18px]" /> {t('Demo Guide')}
        </NavLink>
        <p className="px-3 pt-2 text-[11px] leading-snug text-white/40">All people and records are fictional. Not an official Halmstad University system.</p>
      </div>
    </div>
  );
}

function RoleSwitcher({ role }: { role: Role }) {
  const navigate = useNavigate();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const cfg = ROLES[role];
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-medium text-navy hover:bg-muted-bg" aria-label={t('Switch role')}>
          <cfg.icon className="size-4 text-teal" />
          <span className="hidden sm:inline">{t(cfg.label)}</span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 w-72 rounded-xl border border-border bg-white p-1.5 shadow-xl">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('Switch role')} · demo simulation</p>
          {ROLE_ORDER.map((r) => {
            const c = ROLES[r];
            return (
              <button
                key={r}
                onClick={() => { setOpen(false); navigate(`/${r}`); }}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted-bg', r === role && 'bg-teal-50')}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-navy-50 text-navy"><c.icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy">{t(c.label)}</span>
                  <PersonaName role={r} />
                </span>
                {r === role ? <Check className="size-4 text-teal" /> : null}
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
function PersonaName({ role }: { role: Role }) {
  const { db } = useStore();
  const { personaFor } = useIdentity();
  return <span className="block text-xs text-muted">{userName(db, personaFor(role))}</span>;
}

function NotificationBell({ role }: { role: Role }) {
  const { db, actions, now } = useStore();
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { personaFor } = useIdentity();
  const me = personaFor(role);
  const list = useMemo(() => notificationsFor(db, me, role, now), [db, me, role, now]);
  const unread = list.filter((n) => !n.read);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="relative grid size-9 place-items-center rounded-lg border border-border bg-white text-navy hover:bg-muted-bg" aria-label={`${t('Notifications')} (${unread.length} unread)`}>
          <Bell className="size-[18px]" />
          {unread.length ? <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{unread.length}</span> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 w-[min(380px,calc(100vw-1.5rem))] rounded-xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-navy">{t('Notifications')}</p>
            {unread.length ? <button className="text-xs font-medium text-teal hover:underline" onClick={() => actions.markRead(unread.map((n) => n.id))}>{t('Mark all as read')}</button> : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.length === 0 ? <p className="p-6 text-center text-sm text-muted">You're all caught up.</p> : list.slice(0, 8).map((n) => (
              <button
                key={n.id}
                onClick={() => { actions.markRead([n.id]); setOpen(false); if (n.link) navigate(n.link.startsWith('/' + role) || !n.link.match(/^\/(student|leader|coach|supervisor)/) ? n.link : `/${role}/notifications`); }}
                className={cn('flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted-bg/60', !n.read && 'bg-teal-50/40')}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : n.kind === 'warning' ? 'bg-warning' : 'bg-teal')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy">{n.title}</span>
                  <span className="block text-[13px] leading-snug text-slate-600">{n.body}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{n.derived ? 'Automatic reminder' : fmtDateTime(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setOpen(false); navigate(`/${role}/notifications`); }}>{t('View all')}</Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function ResetButton({ compact }: { compact?: boolean }) {
  const { actions, mode } = useStore();
  const { profile } = useIdentity();
  const [busy, setBusy] = useState(false);
  if (mode === 'cloud' && profile?.role !== 'supervisor') return null;
  const { t } = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={compact ? 'icon' : 'sm'} onClick={() => setOpen(true)} aria-label={t('Reset Demo Data')} title={t('Reset Demo Data')}>
        <RotateCcw />
        {compact ? null : t('Reset Demo Data')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Reset demo data?"
        description={mode === 'cloud'
          ? 'This replaces ALL data in the shared Firestore database — for every user — with the original fictional dataset.'
          : 'All changes made during this demo (attendance, reports, observations, etc.) will be replaced with the original fictional dataset.'}
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
          <Button variant="danger" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await actions.reset(); toast({ title: 'Demo data restored', body: 'The original fictional dataset has been reloaded.' }); }
            catch { toast({ title: 'Reset failed', body: 'Only SI supervisors can reset the shared database.', tone: 'warning' }); }
            setBusy(false); setOpen(false);
          }}>{busy ? 'Resetting…' : 'Reset data'}</Button>
        </>}
      >
        <p className="text-sm text-muted">Use this before each presentation so every scenario starts from the same state.</p>
      </Dialog>
    </>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useT();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'sv' : 'en')}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-navy hover:bg-muted-bg"
      aria-label="Switch language"
      title="Swedish covers navigation and core actions (partial localisation)"
    >
      <Languages className="size-4 text-muted" /> {lang === 'en' ? 'EN' : 'SV'}
    </button>
  );
}

export function AppShell() {
  const role = useRole();
  const { db, mode } = useStore();
  const { profile, canSwitchRoles, personaFor, signOut, user } = useIdentity();
  const { t } = useT();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const cfg = ROLES[role];
  const current = [...cfg.nav].sort((a, b) => b.to.length - a.to.length).find((n) => pathname === n.to || pathname.startsWith(n.to + '/'));
  const title = pathname.startsWith('/guide') ? t('Demo Guide') : current ? t(current.label) : t('Overview');
  const me = userName(db, personaFor(role));
  // Cloud accounts without demo access are locked to their own role
  if (!canSwitchRoles && profile && profile.role !== 'pending' && profile.role !== role && pathname !== '/guide') {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar role={role} /></aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <button className="absolute right-3 top-4 z-10 rounded p-1 text-white/70" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
            <Sidebar role={role} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button className="grid size-9 place-items-center rounded-lg border border-border lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="size-5 text-navy" /></button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-navy">{title}</p>
              <p className="hidden truncate text-xs text-muted sm:block">Halmstad SI · {t(cfg.label)}</p>
            </div>
            <Link to="/guide" className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-teal hover:bg-teal-50 md:inline-flex"><BookOpenCheck className="size-4" />{t('Demo Guide')}</Link>
            <LangSwitch />
            <ResetButton compact />
            {role !== 'supervisor' ? <CalendarConnect variant="header" /> : null}
            {canSwitchRoles ? <RoleSwitcher role={role} /> : null}
            <NotificationBell role={role} />
            <div className="hidden items-center gap-2 border-l border-border pl-3 md:flex">
              <Avatar name={me} />
              <div className="leading-tight">
                <p className="text-sm font-medium text-navy">{me}</p>
                <p className="text-[11px] text-muted">{t(cfg.label)}{mode === 'cloud' && canSwitchRoles ? ' · demo view' : ''}</p>
              </div>
            </div>
            {mode === 'cloud' ? (
              <button onClick={signOut} title={`Signed in as ${user?.email ?? ''} — sign out`} aria-label="Sign out" className="grid size-9 place-items-center rounded-lg border border-border text-navy hover:bg-muted-bg"><LogOut className="size-4" /></button>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
