import { useState, type FormEvent } from 'react';
import { ThumbsUp, Send } from 'lucide-react';
import { useStore } from '@/data/store';
import { coursesOfStudent, courseName } from '@/data/calc';
import { useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { PageHeader, TopicBadge, AutomationNote, EmptyState, Tabs } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn, fmtDate } from '@/lib/utils';

export function StudentTopics() {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const courses = coursesOfStudent(db, id);
  const [course, setCourse] = useState(courses[0] ?? '');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (v.length < 4) return setError('Please describe the topic in a few words (at least 4 characters).');
    if (db.topics.some((t) => t.courseId === course && t.text.toLowerCase() === v.toLowerCase()))
      return setError('This topic has already been requested — vote for it in the list instead.');
    actions.addTopic(course, id, v);
    setText('');
    setError('');
    toast({ title: 'Topic submitted', body: `Your SI leader for ${courseName(db, course)} can now see it.` });
  };

  const list = db.topics
    .filter((t) => courses.includes(t.courseId) && (filter === 'all' || t.courseId === filter))
    .sort((a, b) => b.voterIds.length - a.voterIds.length);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-3"><PageHeader title="Request Topics" description="Suggest what you want to work on in SI and vote for topics other students have suggested." /></div>
      <Card className="h-fit">
        <CardHeader className="flex-col"><CardTitle>Request a topic</CardTitle><CardDescription>Example: “Integration by substitution”.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Course" htmlFor="topic-course">
              <Select id="topic-course" value={course} onChange={(e) => setCourse(e.target.value)}>
                {courses.map((c) => <option key={c} value={c}>{courseName(db, c)}</option>)}
              </Select>
            </Field>
            <Field label="Topic" htmlFor="topic-text" error={error}>
              <Input id="topic-text" value={text} onChange={(e) => { setText(e.target.value); setError(''); }} placeholder="What would you like to discuss?" maxLength={120} aria-invalid={!!error} />
            </Field>
            <Button type="submit" variant="teal" className="w-full"><Send />Submit topic</Button>
          </form>
          <AutomationNote className="mt-4">Requests and votes are instantly visible to the course’s SI leaders, sorted by votes.</AutomationNote>
        </CardContent>
      </Card>
      <div className="space-y-3 lg:col-span-2">
        <Tabs value={filter} onChange={setFilter} items={[{ value: 'all', label: 'All courses' }, ...courses.map((c) => ({ value: c, label: courseName(db, c) }))]} />
        {list.length === 0 ? <EmptyState title="No topics yet" body="Be the first to suggest a topic." /> : list.map((t) => {
          const voted = t.voterIds.includes(id);
          return (
            <div key={t.id} className="flex items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-card">
              <button
                onClick={() => actions.toggleVote(t.id, id)}
                aria-pressed={voted}
                aria-label={voted ? 'Remove vote' : 'Vote for topic'}
                className={cn('flex w-14 shrink-0 flex-col items-center rounded-lg border py-2 transition', voted ? 'border-teal bg-teal-50 text-teal-700' : 'border-border text-slate-500 hover:border-teal-200 hover:text-teal')}
              >
                <ThumbsUp className="size-4" />
                <span className="text-sm font-semibold tabular-nums">{t.voterIds.length}</span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-navy">{t.text}</p>
                <p className="text-xs text-muted">{courseName(db, t.courseId)} · {t.studentId === id ? 'Requested by you' : 'Requested by a student'} · {fmtDate(t.createdAt)}</p>
              </div>
              <TopicBadge status={t.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
