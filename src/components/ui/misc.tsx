import type { ReactNode } from 'react';
import { Sparkles, Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import type { ReportStatus, SessionStatus, ObservationStatus, TopicStatus } from '@/data/types';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'navy', onClick }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: 'navy' | 'teal' | 'warning' | 'success' | 'danger'; onClick?: () => void;
}) {
  const toneCls = { navy: 'bg-navy-50 text-navy', teal: 'bg-teal-50 text-teal-700', warning: 'bg-warning-bg text-warning', success: 'bg-success-bg text-success', danger: 'bg-danger-bg text-danger' }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn('flex w-full items-start gap-3 rounded-xl border border-border bg-white p-4 text-left shadow-card', onClick && 'transition hover:border-teal-200 hover:shadow-md')}
    >
      {Icon ? <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', toneCls)}><Icon className="size-5" /></span> : null}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-navy">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
    </Comp>
  );
}

export function AutomationNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border border-teal-100 bg-teal-50/70 px-3 py-2 text-[13px] text-teal-700', className)}>
      <Sparkles className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ title, body, icon: Icon = Inbox, action }: { title: string; body?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <Icon className="size-8 text-slate-300" />
      <p className="mt-2 text-sm font-medium text-navy">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const map = { scheduled: ['Scheduled', 'navy'], completed: ['Completed', 'success'], attendance_pending: ['Attendance pending', 'warning'], cancelled: ['Cancelled', 'danger'] } as const;
  const [l, t] = map[status];
  return <Badge tone={t}>{l}</Badge>;
}
export function ReportStatusBadge({ status }: { status: ReportStatus | 'none' }) {
  const map = { none: ['Not generated', 'neutral'], draft: ['Draft', 'navy'], submitted: ['Submitted', 'warning'], approved: ['Approved', 'success'], returned: ['Returned for correction', 'danger'] } as const;
  const [l, t] = map[status];
  return <Badge tone={t}>{l}</Badge>;
}
export function ObservationBadge({ status }: { status: ObservationStatus }) {
  const map = { not_scheduled: ['Pending · not scheduled', 'warning'], scheduled: ['Pending · scheduled', 'navy'], draft: ['Draft', 'teal'], completed: ['Completed', 'success'] } as const;
  const [l, t] = map[status];
  return <Badge tone={t}>{l}</Badge>;
}
export function TopicBadge({ status }: { status: TopicStatus }) {
  const map = { open: ['Open', 'neutral'], planned: ['Planned', 'teal'], addressed: ['Addressed', 'success'], not_selected: ['Not selected', 'danger'] } as const;
  const [l, t] = map[status];
  return <Badge tone={t}>{l}</Badge>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-lg bg-muted-bg p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition', value === it.value ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy')}
        >
          {it.label}
          {it.count !== undefined ? <span className="ml-1.5 rounded-full bg-navy-50 px-1.5 text-xs text-navy">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone = 'teal' }: { value: number; tone?: 'teal' | 'navy' | 'warning' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted-bg" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', tone === 'teal' ? 'bg-teal' : tone === 'navy' ? 'bg-navy' : 'bg-warning')} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return <span className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-navy-50 text-xs font-semibold text-navy', className)}>{initials}</span>;
}
