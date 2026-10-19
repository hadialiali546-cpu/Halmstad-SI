import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Check, Save } from 'lucide-react';
import { useStore } from '@/data/store';
import { coursesOfStudent, courseName } from '@/data/calc';
import { useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { PageHeader, AutomationNote } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export function prefChartData(db: ReturnType<typeof useStore>['db'], courseId: string | 'all') {
  return db.timeSlots.map((slot) => ({
    slot: slot.label.replace('day', '').replace('nes', ''),
    full: slot.label,
    id: slot.id,
    votes: db.timePrefs.filter((p) => (courseId === 'all' || p.courseId === courseId) && p.slotIds.includes(slot.id)).length,
  }));
}

export function StudentTimes() {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const courses = coursesOfStudent(db, id);
  const [course, setCourse] = useState(courses[0]);
  const saved = db.timePrefs.find((p) => p.studentId === id && p.courseId === course)?.slotIds ?? [];
  const [sel, setSel] = useState<string[]>(saved);
  useEffect(() => setSel(saved), [course]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = sel.slice().sort().join() !== saved.slice().sort().join();
  const data = prefChartData(db, course);
  const respondents = db.timePrefs.filter((p) => p.courseId === course).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Preferred Times" description="Tell your SI leaders when future sessions would suit you best. Results are aggregated anonymously." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-col"><CardTitle>Your preferences</CardTitle><CardDescription>Select all time slots that work for you.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Select aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)}>
              {courses.map((c) => <option key={c} value={c}>{courseName(db, c)}</option>)}
            </Select>
            <div className="space-y-2" role="group" aria-label="Time slots">
              {db.timeSlots.map((s) => {
                const on = sel.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSel(on ? sel.filter((x) => x !== s.id) : [...sel, s.id])}
                    aria-pressed={on}
                    className={cn('flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm transition', on ? 'border-teal bg-teal-50 font-medium text-teal-700' : 'border-border hover:border-teal-200')}
                  >
                    {s.label}
                    <span className={cn('grid size-5 place-items-center rounded border', on ? 'border-teal bg-teal text-white' : 'border-slate-300')}>{on ? <Check className="size-3.5" /> : null}</span>
                  </button>
                );
              })}
            </div>
            <Button className="w-full" disabled={!dirty} onClick={() => { actions.setTimePrefs(id, course, sel); toast({ title: 'Preferences saved', body: 'SI leaders and supervisors see the updated totals.' }); }}>
              <Save />Save preferences
            </Button>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="flex-col"><CardTitle>Preferences for {courseName(db, course)}</CardTitle><CardDescription>{respondents} student(s) have responded</CardDescription></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid horizontal={false} stroke="#E3E8EE" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="full" width={150} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v) => [v, 'Students']} />
                  <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={20}>
                    {data.map((d) => <Cell key={d.id} fill={saved.includes(d.id) ? '#008D95' : '#12304A'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <AutomationNote className="mt-3">Teal bars are your saved choices. SI leaders and supervisors see these aggregated preferences when planning.</AutomationNote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
