import { useState } from 'react';
import { ThumbsUp, CalendarCheck, CheckCheck, XCircle, RotateCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/data/store';
import { courseName, coursesOfLeader } from '@/data/calc';
import type { TopicStatus } from '@/data/types';
import { useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { PageHeader, TopicBadge, Tabs, EmptyState, AutomationNote } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/utils';
import { prefChartData } from '@/pages/student/StudentTimes';

export function LeaderRequests() {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const courses = coursesOfLeader(db, id);
  const [tab, setTab] = useState<'all' | TopicStatus>('open');
  const [course, setCourse] = useState(courses[0] ?? '');
  const all = db.topics.filter((t) => courses.includes(t.courseId)).sort((a, b) => b.voterIds.length - a.voterIds.length);
  const list = all.filter((t) => tab === 'all' || t.status === tab);
  const data = prefChartData(db, course);
  const set = (tid: string, st: TopicStatus, label: string) => { actions.setTopicStatus(tid, st); toast({ title: `Marked as ${label}`, body: 'Students who requested or voted were notified.' }); };

  return (
    <div className="space-y-6">
      <PageHeader title="Student Requests" description="Topics requested by students in your courses, sorted by votes, and their preferred session times." />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-3 xl:col-span-3">
          <Tabs value={tab} onChange={setTab} items={[
            { value: 'open', label: 'Open', count: all.filter((t) => t.status === 'open').length },
            { value: 'planned', label: 'Planned', count: all.filter((t) => t.status === 'planned').length },
            { value: 'addressed', label: 'Addressed', count: all.filter((t) => t.status === 'addressed').length },
            { value: 'not_selected', label: 'Not selected', count: all.filter((t) => t.status === 'not_selected').length },
            { value: 'all', label: 'All', count: all.length },
          ]} />
          {list.length === 0 ? <EmptyState title="Nothing here" body="No topic requests with this status." /> : list.map((t) => (
            <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-card sm:flex-row sm:items-center">
              <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-navy-50 py-2 text-navy"><ThumbsUp className="size-4" /><span className="text-sm font-semibold">{t.voterIds.length}</span></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy">{t.text}</p>
                <p className="text-xs text-muted">{courseName(db, t.courseId)} · requested {fmtDate(t.createdAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <TopicBadge status={t.status} />
                {t.status !== 'planned' ? <Button size="sm" variant="outline" onClick={() => set(t.id, 'planned', 'planned')}><CalendarCheck />Planned</Button> : null}
                {t.status !== 'addressed' ? <Button size="sm" variant="outline" onClick={() => set(t.id, 'addressed', 'addressed')}><CheckCheck />Addressed</Button> : null}
                {t.status !== 'not_selected' ? <Button size="sm" variant="ghost" onClick={() => set(t.id, 'not_selected', 'not selected')}><XCircle />Not selected</Button> : null}
                {t.status !== 'open' ? <Button size="sm" variant="ghost" aria-label="Reopen" onClick={() => set(t.id, 'open', 'open')}><RotateCcw /></Button> : null}
              </div>
            </div>
          ))}
        </div>
        <Card className="h-fit xl:col-span-2">
          <CardHeader className="flex-col">
            <CardTitle>Preferred session times</CardTitle>
            <CardDescription>{db.timePrefs.filter((p) => p.courseId === course).length} students responded</CardDescription>
            {courses.length > 1 ? <Select aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)} className="mt-2">{courses.map((c) => <option key={c} value={c}>{courseName(db, c)}</option>)}</Select> : <p className="text-sm font-medium text-navy">{courseName(db, course)}</p>}
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#E3E8EE" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="full" width={140} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v) => [v, 'Students']} />
                  <Bar dataKey="votes" fill="#008D95" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <AutomationNote className="mt-3">Preferences come directly from students’ choices on the Student dashboard.</AutomationNote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
