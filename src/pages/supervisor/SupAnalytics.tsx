import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RotateCcw, FileDown } from 'lucide-react';
import { ReachTab, HealthTab, CompareTab, exportManagementSummary } from './insights';
import { Tabs } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { subMonths } from 'date-fns';
import { useStore } from '@/data/store';
import { attendanceMap, monthKey, monthLabel, observationCompletion, semesterLabel, sessionStats, usersByRole } from '@/data/calc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, Label } from '@/components/ui/form';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/misc';
import { attendanceOverTime, colorFor, emptyFilters, filterSessions, months, observationByCoach, perCourse, perLeader, reportingStatus, REPORT_COLORS, semesters, type Filters } from './analytics';

export function SupAnalytics() {
  const { db, now } = useStore();
  const [f, setF] = useState<Filters>(emptyFilters);
  const [tab, setTab] = useState<'charts' | 'reach' | 'health' | 'compare'>('charts');
  const toast = useToast();
  const att = useMemo(() => attendanceMap(db), [db]);
  const sessions = useMemo(() => filterSessions(db, f), [db, f]);
  const st = sessionStats(sessions, att, now);
  const trend = attendanceOverTime(db, sessions, now);
  const courses = perCourse(db, sessions, now);
  const leaders = perLeader(db, sessions, now);
  const leaderIds = f.leader !== 'all' ? [f.leader] : f.course !== 'all' ? db.courseAssignments.filter((a) => a.courseId === f.course).map((a) => a.leaderId) : undefined;
  const obsComp = observationCompletion(db, leaderIds);
  const obs = observationByCoach(db, leaderIds);
  const rep = reportingStatus(db, f.month !== 'all' ? [f.month] : [2, 1, 0].map((i) => monthKey(subMonths(now, i))));
  const faculties = Array.from(new Set(db.courses.map((c) => c.faculty)));
  const sel = (k: keyof Filters, label: string, opts: [string, string][]) => (
    <div className="space-y-1">
      <Label htmlFor={`f-${k}`}>{label}</Label>
      <Select id={`f-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        <option value="all">All</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
    </div>
  );
  const shownCourses = db.courses.filter((c) => courses.some((x) => x.id === c.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Interactive analytics across courses, leaders and reporting." actions={
        <Button variant="teal" onClick={() => { exportManagementSummary(db, now); toast({ title: 'Management summary downloaded', body: 'PDF with key figures, course health and comparison.' }); }}><FileDown />Management summary (PDF)</Button>
      } />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'charts', label: 'Activity' }, { value: 'reach', label: 'Reach & retention' },
        { value: 'health', label: 'Course health' }, { value: 'compare', label: 'Semester comparison' },
      ]} />
      {tab === 'health' ? <HealthTab /> : tab === 'compare' ? <CompareTab /> : <>
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
          {sel('month', 'Month', months(db).map((m) => [m, monthLabel(m)]))}
          {sel('semester', 'Semester', semesters(db).map((s) => [s, semesterLabel(s)]))}
          {sel('course', 'Course', db.courses.map((c) => [c.id, c.name]))}
          {sel('faculty', 'Faculty / academy', faculties.map((x) => [x, x]))}
          {sel('leader', 'SI leader', usersByRole(db, 'leader').map((u) => [u.id, u.name]))}
          <Button variant="outline" onClick={() => setF(emptyFilters)}><RotateCcw />Clear filters</Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Sessions completed" value={st.completed} />
        <StatCard label="Attendance instances" value={st.attendance} tone="teal" />
        <StatCard label="Avg. attendance / session" value={st.avg} />
        <StatCard label="Session hours" value={st.hours} />
        <StatCard label="Observation completion" value={`${obsComp.rate}%`} hint={`${obsComp.done}/${obsComp.total}`} tone="success" />
      </div>
      {tab === 'reach' ? <ReachTab sessions={sessions} /> : sessions.length === 0 ? <EmptyState title="No data for these filters" body="Try clearing one or more filters." /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-col"><CardTitle>1 · Attendance over time</CardTitle><CardDescription>Weekly attendance instances</CardDescription></CardHeader>
            <CardContent><div className="h-72"><ResponsiveContainer>
              <LineChart data={trend} margin={{ left: -10, right: 10 }}>
                <CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Legend />
                {shownCourses.map((c, i) => <Line key={c.id} type="monotone" dataKey={c.id} name={c.name} stroke={colorFor(c.id, i)} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />)}
              </LineChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-col"><CardTitle>2 · Sessions per course</CardTitle><CardDescription>Completed sessions with registered attendance</CardDescription></CardHeader>
            <CardContent><div className="h-64"><ResponsiveContainer>
              <BarChart data={courses} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="short" tickLine={false} axisLine={false} interval={0} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} />
                <Bar dataKey="sessions" name="Sessions" fill="#12304A" radius={[4, 4, 0, 0]} barSize={36} />
                <Bar dataKey="pending" name="Attendance pending" fill="#E0A23B" radius={[4, 4, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-col"><CardTitle>3 · Average attendance by course</CardTitle><CardDescription>Attendance instances per completed session</CardDescription></CardHeader>
            <CardContent><div className="h-64"><ResponsiveContainer>
              <BarChart data={courses} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="short" tickLine={false} axisLine={false} interval={0} /><YAxis tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} />
                <Bar dataKey="avg" name="Average attendance" fill="#008D95" radius={[4, 4, 0, 0]} barSize={44} />
              </BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-col"><CardTitle>4 · SI leader activity</CardTitle><CardDescription>Sessions delivered and attendance per leader</CardDescription></CardHeader>
            <CardContent><div className="h-72"><ResponsiveContainer>
              <BarChart data={leaders} layout="vertical" margin={{ left: 0, right: 16 }}><CartesianGrid horizontal={false} stroke="#E3E8EE" /><XAxis type="number" tickLine={false} axisLine={false} /><YAxis type="category" dataKey="short" width={80} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} /><Legend />
                <Bar dataKey="sessions" name="Sessions" fill="#12304A" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="attendance" name="Attendance" fill="#008D95" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-col"><CardTitle>5 · Observation completion</CardTitle><CardDescription>By SI coach (period HT2026). A process measure — not a quality rating.</CardDescription></CardHeader>
            <CardContent><div className="h-72"><ResponsiveContainer>
              <BarChart data={obs} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} /><Legend />
                <Bar dataKey="completed" name="Completed" stackId="o" fill="#3E8E63" />
                <Bar dataKey="scheduled" name="Scheduled / draft" stackId="o" fill="#6C8EAD" />
                <Bar dataKey="notScheduled" name="Not scheduled" stackId="o" fill="#E0A23B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="flex-col"><CardTitle>6 · Monthly reporting status</CardTitle><CardDescription>Leader and coach reports per reporting month</CardDescription></CardHeader>
            <CardContent><div className="h-64"><ResponsiveContainer>
              <BarChart data={rep} layout="vertical" margin={{ left: 10, right: 16 }}><CartesianGrid horizontal={false} stroke="#E3E8EE" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="month" width={80} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} /><Legend />
                {Object.entries(REPORT_COLORS).map(([k, c]) => <Bar key={k} dataKey={k} stackId="r" fill={c} barSize={22} />)}
              </BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
        </div>
      )}
      </>}
    </div>
  );
}
