import { useMemo, useState } from 'react';
import { Inbox, Mail, Lightbulb, Rocket, Clock } from 'lucide-react';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/misc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/form';
import { cn, fmtDateTime } from '@/lib/utils';
import {
  KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL, useFeatureRequests, type FeatureRequest, type RequestStatus,
} from '@/lib/featureRequests';

const STATUS_TONE: Record<RequestStatus, 'teal' | 'navy' | 'warning' | 'success' | 'neutral'> = {
  new: 'teal', planned: 'navy', in_progress: 'warning', shipped: 'success', declined: 'neutral',
};
const FILTERS: ('open' | 'all' | RequestStatus)[] = ['open', 'all', 'new', 'planned', 'in_progress', 'shipped', 'declined'];
const isOpen = (r: FeatureRequest) => r.status !== 'shipped' && r.status !== 'declined';

export function SupFeedback() {
  const { list, setStatus, error } = useFeatureRequests();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const shown = useMemo(() => list.filter((r) => (filter === 'all' ? true : filter === 'open' ? isOpen(r) : r.status === filter)), [list, filter]);

  return (
    <div>
      <PageHeader title="Feedback inbox" description="Feature requests and feedback sent from the “Request a feature” button. Reply by email and keep the status up to date." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="New" value={list.filter((r) => r.status === 'new').length} icon={Inbox} tone="teal" onClick={() => setFilter('new')} />
        <StatCard label="Planned or in progress" value={list.filter((r) => r.status === 'planned' || r.status === 'in_progress').length} icon={Clock} tone="navy" onClick={() => setFilter('open')} />
        <StatCard label="Shipped" value={list.filter((r) => r.status === 'shipped').length} icon={Rocket} tone="success" onClick={() => setFilter('shipped')} />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium', filter === f ? 'border-navy bg-navy text-white' : 'border-border bg-white text-slate-600 hover:bg-muted-bg')}>
            {f === 'open' ? 'Open' : f === 'all' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-danger" role="alert">{error}</p> : null}
      {shown.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Nothing here yet" body="Requests appear here as soon as someone uses the “Request a feature” button in the sidebar." />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    <Badge tone="neutral">{KIND_LABEL[r.kind]}</Badge>
                    {r.priority === 'blocking' ? <Badge tone="danger">{PRIORITY_LABEL[r.priority]}</Badge> : <Badge tone="neutral">{PRIORITY_LABEL[r.priority]}</Badge>}
                    <span className="text-xs text-muted">{r.ref}</span>
                  </div>
                  <h2 className="mt-2 text-[15px] font-semibold text-navy">{r.title}</h2>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{r.details}</p>
                  <p className="mt-2 text-xs text-muted">{r.area} · {r.name} · {fmtDateTime(r.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-row gap-2 sm:w-44 sm:flex-col">
                  <label className="sr-only" htmlFor={`st-${r.id}`}>Status for {r.ref}</label>
                  <Select id={`st-${r.id}`} value={r.status} onChange={(e) => setStatus(r.id, e.target.value as RequestStatus)}>
                    {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Select>
                  <a
                    href={`mailto:${r.email}?subject=${encodeURIComponent(`Your Halmstad SI request ${r.ref}: ${r.title}`)}`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-medium text-navy hover:bg-muted-bg"
                  >
                    <Mail className="size-4" /> Reply
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
