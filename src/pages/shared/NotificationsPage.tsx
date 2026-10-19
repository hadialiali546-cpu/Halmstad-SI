import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Sparkles } from 'lucide-react';
import { useStore } from '@/data/store';
import { notificationsFor } from '@/data/notifications';
import { useMe } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState, Tabs, AutomationNote } from '@/components/ui/misc';
import { cn, fmtDateTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function NotificationsPage() {
  const { db, actions, now } = useStore();
  const { role, id } = useMe();
  const { t } = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const all = useMemo(() => notificationsFor(db, id, role, now), [db, id, role, now]);
  const list = tab === 'unread' ? all.filter((n) => !n.read) : all;
  return (
    <div>
      <PageHeader
        title={t('Notifications')}
        description="Reminders are generated from live records and disappear automatically once the task is done. Delivered in-app only (no real email/SMS in this demo)."
        actions={<Button variant="outline" onClick={() => actions.markRead(all.map((n) => n.id))} disabled={!all.some((n) => !n.read)}><CheckCheck />{t('Mark all as read')}</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'all', label: 'All', count: all.length }, { value: 'unread', label: 'Unread', count: all.filter((n) => !n.read).length }]} />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" body="You're all caught up." />
      ) : (
        <Card className="divide-y divide-border">
          {list.map((n) => (
            <div key={n.id} className={cn('flex flex-col gap-3 p-4 sm:flex-row sm:items-center', !n.read && 'bg-teal-50/30')}>
              <span className={cn('hidden size-2 shrink-0 rounded-full sm:block', n.read ? 'bg-slate-200' : n.kind === 'warning' ? 'bg-warning' : 'bg-teal')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy">{n.title}{!n.read ? <span className="ml-2 text-xs font-medium text-teal">New</span> : null}</p>
                <p className="text-sm text-slate-600">{n.body}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  {n.derived ? <><Sparkles className="size-3" /> Automatic reminder from current records</> : fmtDateTime(n.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {n.link && n.link.startsWith('/' + role) ? <Button size="sm" variant="outline" onClick={() => { actions.markRead([n.id]); navigate(n.link!); }}>Open</Button> : null}
                {n.read ? <Button size="sm" variant="ghost" onClick={() => actions.markUnread(n.id)}>Mark unread</Button> : <Button size="sm" variant="ghost" onClick={() => actions.markRead([n.id])}>Mark read</Button>}
              </div>
            </div>
          ))}
        </Card>
      )}
      <AutomationNote className="mt-4">Example: once the missing attendance is registered, the “Attendance missing” reminder is removed for the leader and the supervisor’s count drops.</AutomationNote>
    </div>
  );
}
