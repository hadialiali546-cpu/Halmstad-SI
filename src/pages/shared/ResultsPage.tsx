import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { FileSpreadsheet, GraduationCap, MessageSquareHeart, Star, CheckCircle2, Info, Plus, Trash2, CalendarX2, Search, Bell } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { courseName, coursesOfStudent, leadersOfCoach, leadersOfCourse, userName } from '@/data/calc';
import { GRADES, type Grade, type QuestionType, type SurveyQuestion } from '@/data/types';
import { useMe } from '@/lib/hooks';
import {
  correlationSummary, courseFinished, evaluationSummary, finishedCourses, groupSummary, GROUPS, GRADE_VALUE, resultRows, sessionsAttended, strength,
} from '@/lib/results';
import { exportXLSX } from '@/lib/files';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { PageHeader, StatCard, Tabs, AutomationNote, EmptyState } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { cn, fmtDate } from '@/lib/utils';

const GRADE_COLORS: Record<Grade, string> = { U: '#C2504A', '3': '#E0A23B', '4': '#6C8EAD', '5': '#008D95' };
const MIN_GROUP_AGGREGATED = 3; // students and SI leaders: hide groups smaller than this

// ======================================================================
export function ResultsPage() {
  const { role } = useMe();
  if (role === 'student') return <StudentResults />;
  return <StaffResults key={role} />; // reset tabs/filters when switching role
}

// ---------------------------------------------------------------- student
function StudentResults() {
  const { db, now } = useStore();
  const { id } = useMe();
  const mine = coursesOfStudent(db, id).map((c) => db.courses.find((x) => x.id === c)!);
  const finished = mine.filter((c) => courseFinished(db, c.id, now));
  const ongoing = mine.filter((c) => !courseFinished(db, c.id, now));
  const [evalFor, setEvalFor] = useState<string | null>(null);
  const allFinished = finishedCourses(db, now).map((c) => c.id);

  return (
    <div className="space-y-6">
      <PageHeader title="SI & Results" description="When a course ends, evaluate your SI leader and report your final exam result. Your answers help improve SI and show how it supports students." />
      {finished.length ? finished.map((c) => (
        <FinishedCourseCard key={c.id} courseId={c.id} onEvaluate={() => setEvalFor(c.id)} />
      )) : <EmptyState icon={GraduationCap} title="No finished courses yet" body="When one of your courses ends you’ll be asked to evaluate SI and report your result." />}
      {ongoing.length ? (
        <p className="text-sm text-muted">Still running: {ongoing.map((c) => `${c.name} (ends ${c.endDate ? fmtDate(c.endDate) : '—'})`).join(' · ')}</p>
      ) : null}
      {allFinished.length ? (
        <div>
          <h2 className="mb-3 font-semibold text-navy">How SI attendance relates to results</h2>
          <CorrelationView courseIds={allFinished} names={false} minGroup={MIN_GROUP_AGGREGATED} canExport={false} />
        </div>
      ) : null}
      <EvaluationDialog courseId={evalFor} onClose={() => setEvalFor(null)} />
    </div>
  );
}

function FinishedCourseCard({ courseId, onEvaluate }: { courseId: string; onEvaluate: () => void }) {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const c = db.courses.find((x) => x.id === courseId)!;
  const existing = db.grades.find((g) => g.courseId === courseId && g.studentId === id);
  const evaluated = db.evaluations.some((e) => e.courseId === courseId && e.studentId === id);
  const attended = sessionsAttended(db, id, courseId);
  const [grade, setGrade] = useState<Grade | ''>(existing?.grade ?? '');
  const [consent, setConsent] = useState(existing?.consent ?? false);
  const [editing, setEditing] = useState(!existing);
  const [err, setErr] = useState('');
  const submit = () => {
    if (!grade) return setErr('Choose your grade.');
    if (!consent) return setErr('Please confirm that your result may be used as described.');
    actions.reportGrade(courseId, id, grade, consent);
    setEditing(false); setErr('');
    toast({ title: 'Result reported — thank you!', body: 'Weekly reminders for this course have stopped.' });
  };
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-xs font-medium text-teal-700">{c.code} · finished {c.endDate ? fmtDate(c.endDate) : ''}</p>
          <CardTitle className="text-lg">{c.name}</CardTitle>
          <CardDescription>You attended {attended} SI session{attended === 1 ? '' : 's'} with {leadersOfCourse(db, courseId).map((l) => userName(db, l)).join(' / ')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 font-semibold text-navy"><MessageSquareHeart className="size-4 text-teal" />1. Evaluate your SI leader</p>
          {evaluated ? <p className="mt-2 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />Thank you — evaluation submitted.</p>
            : attended ? <>
              <p className="mt-1 text-sm text-muted">7 short questions. Your SI leader only sees anonymous summaries.</p>
              <Button className="mt-3" variant="teal" onClick={onEvaluate}>Start evaluation</Button>
            </> : <p className="mt-2 text-sm text-muted">Only students who attended SI evaluate the SI leader.</p>}
        </div>
        <div className={cn('rounded-xl border p-4', existing && !editing ? 'border-success/30 bg-success-bg/40' : 'border-warning/40 bg-warning-bg/30')}>
          <p className="flex items-center gap-2 font-semibold text-navy"><GraduationCap className="size-4 text-teal" />2. Report your final exam result</p>
          {existing && !editing ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-2 text-success"><CheckCircle2 className="size-4" />Reported: <span className="text-lg font-semibold">{existing.grade}</span></span>
              <span className="text-muted">{fmtDate(existing.reportedAt)}</span>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Change</Button>
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              <p className="flex items-center gap-1.5 text-xs text-warning"><Bell className="size-3.5" />You’ll get a reminder every week until you report.</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Final grade">
                {GRADES.map((g) => (
                  <button key={g} role="radio" aria-checked={grade === g} onClick={() => { setGrade(g); setErr(''); }}
                    className={cn('h-11 w-14 rounded-lg border text-lg font-semibold transition', grade === g ? 'border-teal bg-teal text-white' : 'border-border bg-white text-navy hover:border-teal-200')}>{g}</button>
                ))}
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input type="checkbox" className="mt-0.5 size-4 accent-teal" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(''); }} />
                I agree that my result is stored and linked to my SI attendance. SI supervisors and coaches can see it with my name; SI leaders and other students only see anonymous statistics.
              </label>
              {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
              <div className="flex gap-2">
                <Button onClick={submit}>Submit result</Button>
                {existing ? <Button variant="ghost" onClick={() => { setEditing(false); setGrade(existing.grade); }}>Cancel</Button> : null}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EvaluationDialog({ courseId, onClose }: { courseId: string | null; onClose: () => void }) {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const leaders = courseId ? leadersOfCourse(db, courseId) : [];
  const mostAttended = useMemo(() => {
    if (!courseId) return '';
    const counts = leaders.map((l) => ({ l, n: db.attendance.filter((a) => a.studentIds?.includes(id) && db.sessions.find((s) => s.id === a.sessionId)?.leaderId === l).length }));
    return counts.sort((a, b) => b.n - a.n)[0]?.l ?? '';
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [leaderId, setLeaderId] = useState('');
  const [ans, setAns] = useState<Record<string, string | number>>({});
  const [err, setErr] = useState('');
  if (!courseId) return null;
  const lid = leaderId || mostAttended;
  const submit = () => {
    const missing = db.evaluationTemplate.filter((q) => q.type !== 'text' && (ans[q.id] === undefined || ans[q.id] === ''));
    if (missing.length) return setErr(`Please answer: ${missing.map((q) => `“${q.text}”`).join(', ')}`);
    actions.submitEvaluation(courseId, id, lid, ans);
    toast({ title: 'Evaluation submitted', body: 'Thank you! Your SI leader sees only anonymous summaries.' });
    setAns({}); setErr(''); setLeaderId('');
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title="Evaluate your SI leader" description={`${courseName(db, courseId)} · anonymous to your SI leader`}
      footer={<><Button variant="outline" onClick={onClose}>Later</Button><Button variant="teal" onClick={submit}>Submit evaluation</Button></>}>
      <div className="space-y-5">
        {leaders.length > 1 ? (
          <Field label="Which SI leader did you mostly attend?" htmlFor="ev-leader">
            <Select id="ev-leader" value={lid} onChange={(e) => setLeaderId(e.target.value)}>{leaders.map((l) => <option key={l} value={l}>{userName(db, l)}</option>)}</Select>
          </Field>
        ) : null}
        {db.evaluationTemplate.map((q, i) => (
          <div key={q.id}>
            <p className="mb-2 text-sm font-medium text-navy">{i + 1}. {q.text.replace('your SI leader', userName(db, lid))}{q.type === 'text' ? <span className="font-normal text-muted"> (optional)</span> : null}</p>
            {q.type === 'rating' ? (
              <div className="flex items-center gap-1" role="radiogroup" aria-label={q.text}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={ans[q.id] === n} aria-label={`${n} of 5`} onClick={() => setAns({ ...ans, [q.id]: n })} className="p-0.5">
                    <Star className={cn('size-7', Number(ans[q.id] ?? 0) >= n ? 'fill-[#E0A23B] text-[#E0A23B]' : 'text-slate-300')} />
                  </button>
                ))}
                <span className="ml-2 text-xs text-muted">1 = disagree / poor · 5 = agree / excellent</span>
              </div>
            ) : q.type === 'choice' ? (
              <div className="flex flex-wrap gap-2">
                {(q.options ?? []).map((o) => (
                  <button key={o} aria-pressed={ans[q.id] === o} onClick={() => setAns({ ...ans, [q.id]: o })} className={cn('rounded-lg border px-4 py-1.5 text-sm', ans[q.id] === o ? 'border-teal bg-teal-50 text-teal-700' : 'border-border')}>{o}</button>
                ))}
              </div>
            ) : (
              <Textarea aria-label={q.text} value={String(ans[q.id] ?? '')} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} rows={2} className="min-h-[60px]" />
            )}
          </div>
        ))}
        {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- staff
function StaffResults() {
  const { db, now } = useStore();
  const { role, id } = useMe();
  const finished = finishedCourses(db, now);
  const names = role === 'supervisor' || role === 'coach';
  // Coaches see names for courses where their SI leaders work; aggregated statistics everywhere else
  const coachCourses = role === 'coach' ? Array.from(new Set(db.courseAssignments.filter((a) => leadersOfCoach(db, id).includes(a.leaderId)).map((a) => a.courseId))) : [];
  const [course, setCourse] = useState<string>('all');
  const [tab, setTab] = useState<'results' | 'evaluations' | 'questions' | 'dates'>('results');
  const ids = course === 'all' ? finished.map((c) => c.id) : [course];
  const showNames = names && (role === 'supervisor' || ids.every((c) => coachCourses.includes(c)));
  const evalLeaders = role === 'leader' ? [id] : role === 'coach' ? leadersOfCoach(db, id) : undefined;

  const tabs = [
    { value: 'results' as const, label: 'Attendance & grades' },
    { value: 'evaluations' as const, label: role === 'leader' ? 'My SI evaluations' : 'SI leader evaluations' },
    ...(role === 'supervisor' ? [{ value: 'questions' as const, label: 'Evaluation questions' }, { value: 'dates' as const, label: 'Course end dates' }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="SI & Results"
        description={role === 'leader'
          ? 'How SI attendance relates to final grades (anonymous statistics) and what students say about your sessions.'
          : 'End-of-course SI evaluations and self-reported final grades, linked to named SI attendance.'}
        actions={tab === 'results' || tab === 'evaluations' ? (
          <Select aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)} className="w-56">
            <option value="all">All finished courses ({finished.length})</option>
            {finished.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        ) : undefined}
      />
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {tab === 'dates' ? <CourseEndDates /> : tab === 'questions' ? <TemplateEditor /> : !finished.length ? (
        <EmptyState icon={GraduationCap} title="No finished courses yet" body="Results and evaluations appear here when a course ends." />
      ) : tab === 'results' ? (
        <CorrelationView courseIds={ids} names={showNames} minGroup={names ? 0 : MIN_GROUP_AGGREGATED} canExport />
      ) : (
        <EvaluationView courseIds={ids} leaderIds={evalLeaders} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- correlation
function CorrelationView({ courseIds, names, minGroup, canExport }: { courseIds: string[]; names: boolean; minGroup: number; canExport: boolean }) {
  const { db } = useStore();
  const toast = useToast();
  const rows = useMemo(() => resultRows(db, courseIds), [db, courseIds]);
  const sum = correlationSummary(rows);
  const groups = groupSummary(rows, minGroup);
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const scatter = rows.filter((r) => r.grade).map((r, i) => ({ x: r.attended + ((i * 37) % 7 - 3) * 0.06, y: GRADE_VALUE[r.grade!] + ((i * 53) % 5 - 2) * 0.07, name: r.name, grade: r.grade, attended: r.attended }));

  const doExport = () => {
    const cname = courseIds.length === 1 ? courseName(db, courseIds[0]).replace(/\s+/g, '-') : 'all-finished-courses';
    const per = courseIds.map((c) => ({ c, s: correlationSummary(resultRows(db, [c])) }));
    exportXLSX([
      {
        name: 'Summary', note: 'SI attendance and self-reported final grades — Halmstad SI concept demo (fictional data)',
        rows: [...per.map(({ c, s }) => ({
          Course: courseName(db, c), 'Students on list': s.total, 'Grades reported': s.reported, 'Response rate %': s.responseRate,
          'Spearman rho (sessions vs grade)': s.rho ?? '', Interpretation: strength(s.rho), 'Pass rate with SI %': s.passSI ?? '', 'Pass rate without SI %': s.passNoSI ?? '',
        })), ...(per.length > 1 ? [{
          Course: 'All selected', 'Students on list': sum.total, 'Grades reported': sum.reported, 'Response rate %': sum.responseRate,
          'Spearman rho (sessions vs grade)': sum.rho ?? '', Interpretation: strength(sum.rho), 'Pass rate with SI %': sum.passSI ?? '', 'Pass rate without SI %': sum.passNoSI ?? '',
        }] : [])],
      },
      {
        name: 'By attendance group',
        headers: ['SI attendance', 'Students with grade', 'U', '3', '4', '5', 'Pass rate %', 'Average grade (passed)'],
        rows: groups.map((g) => ({ 'SI attendance': g.label, 'Students with grade': g.hidden ? `<${minGroup}` : g.n, U: g.hidden ? '' : g.U, '3': g.hidden ? '' : g['3'], '4': g.hidden ? '' : g['4'], '5': g.hidden ? '' : g['5'], 'Pass rate %': g.passRate ?? '', 'Average grade (passed)': g.avgPassed ?? '' })),
      },
      names
        ? { name: 'Students', rows: rows.map((r) => ({ Student: r.name, Email: db.users.find((u) => u.id === r.studentId)?.email ?? '', Course: courseName(db, r.courseId), 'SI sessions attended': r.attended, 'Final grade': r.grade ?? 'Not reported', 'Reported on': r.reportedAt ? format(parseISO(r.reportedAt), 'yyyy-MM-dd') : '' })) }
        : { name: 'Students (anonymised)', rows: rows.filter((r) => r.grade).map((r) => ({ 'SI sessions attended': r.attended, 'Final grade': r.grade! })).sort((a, b) => a['SI sessions attended'] - b['SI sessions attended']) },
      {
        name: 'About', rows: [
          { Note: 'Grades are self-reported by students (U/3/4/5) after the course ends; weekly reminders until reported.' },
          { Note: 'Spearman rank correlation between number of SI sessions attended and grade (U=0, 3, 4, 5).' },
          { Note: 'Correlation does not prove that SI causes better grades: students who choose SI may differ (motivation, prior knowledge).' },
          { Note: 'In production, official results from Ladok would replace self-reported grades.' },
        ],
      },
    ], `SI-attendance-vs-grades-${cname}-${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast({ title: 'Excel report downloaded', body: names ? 'Includes a named student sheet (restricted data).' : 'Anonymous statistics only.' });
  };

  const list = rows.filter((r) => (!onlyMissing || !r.grade) && r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.attended - a.attended);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Grades reported" value={`${sum.reported} / ${sum.total}`} hint={`${sum.responseRate}% response · weekly reminders active`} />
        <StatCard label="Correlation (Spearman ρ)" value={sum.rho ?? '—'} hint={strength(sum.rho)} tone="teal" />
        <StatCard label="Pass rate — attended SI" value={sum.passSI !== null ? `${sum.passSI}%` : '—'} hint={`${sum.nSI} students`} tone="success" />
        <StatCard label="Pass rate — no SI" value={sum.passNoSI !== null && (minGroup === 0 || sum.nNoSI >= minGroup) ? `${sum.passNoSI}%` : '—'} hint={`${sum.nNoSI} students`} tone="warning" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-col"><CardTitle>Grades by SI attendance</CardTitle><CardDescription>Number of students per grade, grouped by sessions attended</CardDescription></CardHeader>
          <CardContent><div className="h-72"><ResponsiveContainer>
            <BarChart data={groups} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} /><Legend />
              {GRADES.map((g) => <Bar key={g} dataKey={g} name={`Grade ${g}`} stackId="g" fill={GRADE_COLORS[g]} />)}
            </BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-col"><CardTitle>Pass rate by SI attendance</CardTitle><CardDescription>Share of reported grades that are 3, 4 or 5</CardDescription></CardHeader>
          <CardContent><div className="h-72"><ResponsiveContainer>
            <BarChart data={groups.map((g) => ({ ...g, passRate: g.passRate ?? 0 }))} margin={{ left: -20 }}><CartesianGrid vertical={false} stroke="#E3E8EE" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#F1F4F8' }} formatter={(v, _n, p) => [p.payload.hidden ? 'hidden (too few students)' : `${v}% (n=${p.payload.n})`, 'Pass rate']} />
              <Bar dataKey="passRate" name="Pass rate" fill="#12304A" radius={[4, 4, 0, 0]} barSize={44} />
            </BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        {names ? (
          <Card className="lg:col-span-2">
            <CardHeader className="flex-col"><CardTitle>Each student: sessions attended vs grade</CardTitle><CardDescription>Hover a dot to see the student (visible to supervisors and coaches only)</CardDescription></CardHeader>
            <CardContent><div className="h-72"><ResponsiveContainer>
              <ScatterChart margin={{ left: -10, right: 20 }}>
                <CartesianGrid stroke="#E3E8EE" />
                <XAxis type="number" dataKey="x" name="Sessions attended" domain={[-0.5, (max: number) => Math.ceil(max) + 1]} tickLine={false} axisLine={false} allowDecimals={false} label={{ value: 'SI sessions attended', position: 'insideBottom', offset: -2, fontSize: 12, fill: '#64748B' }} />
                <YAxis type="number" dataKey="y" domain={[-0.5, 5.5]} ticks={[0, 3, 4, 5]} tickFormatter={(v) => (v === 0 ? 'U' : String(v))} tickLine={false} axisLine={false} />
                <ZAxis range={[70, 70]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                  const p = payload?.[0]?.payload as (typeof scatter)[number] | undefined;
                  return p ? <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm shadow"><p className="font-medium text-navy">{p.name}</p><p className="text-muted">{p.attended} sessions · grade {p.grade}</p></div> : null;
                }} />
                <Scatter data={scatter} fill="#008D95" fillOpacity={0.75} />
              </ScatterChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
        ) : null}
      </div>

      {names ? (
        <Card>
          <CardHeader>
            <div><CardTitle>Students</CardTitle><CardDescription>Named data — restricted to SI supervisors and coaches</CardDescription></div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="size-4 accent-teal" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />Not reported only</label>
              <div className="relative w-48"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input aria-label="Search student" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9" /></div>
            </div>
          </CardHeader>
          <div className="max-h-96 overflow-auto">
            <Table>
              <THead><TR><TH>Student</TH><TH>Course</TH><TH className="text-right">SI sessions</TH><TH>Final grade</TH><TH className="hidden sm:table-cell">Reported</TH></TR></THead>
              <TBody>
                {list.map((r) => (
                  <TR key={r.studentId + r.courseId}>
                    <TD className="font-medium text-navy">{r.name}</TD>
                    <TD>{courseName(db, r.courseId)}</TD>
                    <TD className="text-right tabular-nums">{r.attended}</TD>
                    <TD>{r.grade ? <span className="inline-grid size-7 place-items-center rounded-md text-sm font-semibold text-white" style={{ background: GRADE_COLORS[r.grade] }}>{r.grade}</span> : <Badge tone="warning">Not reported · reminded weekly</Badge>}</TD>
                    <TD className="hidden text-muted sm:table-cell">{r.reportedAt ? fmtDate(r.reportedAt) : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted"><Info className="mt-0.5 size-4 shrink-0" />Anonymous statistics. Groups with fewer than {minGroup} students are hidden so no one can be identified{groups.some((g) => g.hidden) ? ` (hidden now: ${groups.filter((g) => g.hidden).map((g) => g.label).join(', ')})` : ''}.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AutomationNote className="flex-1">Named attendance + self-reported grades give the programme evidence of how SI relates to results — without manual spreadsheets. Correlation does not prove causation: students who choose SI may also differ in motivation.</AutomationNote>
        {canExport ? <Button onClick={doExport}><FileSpreadsheet />Export Excel report</Button> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- evaluations
function EvaluationView({ courseIds, leaderIds }: { courseIds: string[]; leaderIds?: string[] }) {
  const { db } = useStore();
  const toast = useToast();
  const data = evaluationSummary(db, courseIds, leaderIds);
  if (!data.length) return <EmptyState icon={MessageSquareHeart} title="No evaluations yet" body={leaderIds?.length === 1 ? 'Evaluations of you appear when one of your courses ends and students respond.' : 'No evaluations for the selected courses.'} />;
  const doExport = () => {
    exportXLSX([{
      name: 'SI evaluations', note: 'End-of-course SI leader evaluations — anonymous summaries (fictional demo data)',
      rows: data.flatMap((d) => d.questions.filter((x) => x.q.type !== 'text').map((x) => ({
        'SI leader': userName(db, d.leaderId), Responses: d.n, Question: x.q.text,
        Result: x.q.type === 'rating' ? (x.avg ?? '') : Object.entries(x.counts).map(([k, v]) => `${k}: ${v}`).join(', '),
      }))),
    }], `SI-evaluations-${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast({ title: 'Excel downloaded' });
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {data.map((d) => (
          <Card key={d.leaderId}>
            <CardHeader>
              <div><CardTitle>{userName(db, d.leaderId)}</CardTitle><CardDescription>{d.n} anonymous evaluation{d.n === 1 ? '' : 's'}</CardDescription></div>
              {d.questions.find((x) => x.q.id === 'e4')?.avg ? <span className="flex items-center gap-1 text-2xl font-semibold text-navy"><Star className="size-5 fill-[#E0A23B] text-[#E0A23B]" />{d.questions.find((x) => x.q.id === 'e4')!.avg}</span> : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {d.n === 0 ? <p className="text-sm text-muted">No responses yet.</p> : d.questions.map((x) => (
                <div key={x.q.id}>
                  <p className="text-sm text-slate-700">{x.q.text}</p>
                  {x.q.type === 'rating' ? (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted-bg"><div className="h-full rounded-full bg-teal" style={{ width: `${((x.avg ?? 0) / 5) * 100}%` }} /></div>
                      <span className="w-10 text-right text-sm font-semibold tabular-nums text-navy">{x.avg ?? '—'}</span>
                    </div>
                  ) : x.q.type === 'choice' ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">{Object.entries(x.counts).map(([k, v]) => <Badge key={k} tone={k === 'Yes' ? 'success' : k === 'No' ? 'danger' : 'neutral'}>{k}: {v}</Badge>)}</div>
                  ) : (
                    <ul className="mt-1 space-y-1">{x.texts.filter(Boolean).slice(0, 3).map((t, i) => <li key={i} className="rounded-lg bg-canvas px-3 py-1.5 text-sm text-slate-600">“{t}”</li>)}</ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AutomationNote className="flex-1">Evaluations are sent automatically when a course ends, to every student who attended SI. Responses are anonymous; SI leaders see summaries only.</AutomationNote>
        <Button variant="outline" onClick={doExport}><FileSpreadsheet />Export Excel</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- supervisor: template & dates
function TemplateEditor() {
  const { db, actions } = useStore();
  const toast = useToast();
  const [qs, setQs] = useState<SurveyQuestion[]>(() => structuredClone(db.evaluationTemplate));
  const [err, setErr] = useState('');
  const set = (i: number, patch: Partial<SurveyQuestion>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const save = () => {
    const clean = qs.filter((q) => q.text.trim()).map((q) => ({ ...q, text: q.text.trim(), options: q.type === 'choice' ? (q.options ?? []).filter((o) => o.trim()) : undefined }));
    if (!clean.length) return setErr('Add at least one question.');
    if (clean.some((q) => q.type === 'choice' && (q.options?.length ?? 0) < 2)) return setErr('Multiple-choice questions need at least two options.');
    actions.saveEvaluationTemplate(clean); setErr('');
    toast({ title: 'Evaluation questions saved', body: 'Used for courses that finish from now on.' });
  };
  return (
    <Card>
      <CardHeader className="flex-col"><CardTitle>End-of-course SI evaluation</CardTitle><CardDescription>Standard questions sent to students who attended SI when a course ends. Edit per semester.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {qs.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <span className="pt-2 text-sm font-semibold text-muted">{i + 1}.</span>
              <Input aria-label={`Question ${i + 1}`} value={q.text} onChange={(e) => set(i, { text: e.target.value })} className="flex-1" />
              <Select aria-label="Type" value={q.type} onChange={(e) => set(i, { type: e.target.value as QuestionType, options: e.target.value === 'choice' ? (q.options?.length ? q.options : ['Yes', 'No']) : undefined })} className="sm:w-44">
                <option value="rating">Rating (1–5)</option><option value="choice">Multiple choice</option><option value="text">Free text</option>
              </Select>
              <Button size="icon" variant="ghost" aria-label="Remove question" onClick={() => setQs(qs.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
            {q.type === 'choice' ? (
              <Input aria-label="Options" className="mt-2 h-8" value={(q.options ?? []).join(', ')} onChange={(e) => set(i, { options: e.target.value.split(',').map((x) => x.trimStart()) })} placeholder="Options, comma separated" />
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setQs([...qs, { id: `e${Date.now()}`, type: 'rating', text: '' }])}><Plus />Add question</Button>
          <Button size="sm" onClick={save}>Save questions</Button>
        </div>
        {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
        <p className="text-xs text-muted">Changing questions does not alter answers already submitted. Results per question are matched by question ID.</p>
      </CardContent>
    </Card>
  );
}

function CourseEndDates() {
  const { db, actions, now } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader className="flex-col"><CardTitle>Course end dates</CardTitle><CardDescription>When a course ends, students automatically get the SI evaluation and weekly reminders to report their final grade.</CardDescription></CardHeader>
      <Table>
        <THead><TR><TH>Course</TH><TH>End date</TH><TH>Status</TH><TH className="text-right">Grades reported</TH><TH /></TR></THead>
        <TBody>
          {db.courses.map((c) => {
            const done = courseFinished(db, c.id, now);
            const rows = resultRows(db, [c.id]);
            return (
              <TR key={c.id}>
                <TD className="font-medium text-navy">{c.name}</TD>
                <TD><Input type="date" aria-label={`End date for ${c.name}`} value={c.endDate ?? ''} onChange={(e) => e.target.value && actions.setCourseEndDate(c.id, e.target.value)} className="h-8 w-40" /></TD>
                <TD>{done ? <Badge tone="success">Finished</Badge> : <Badge tone="navy">Running</Badge>}</TD>
                <TD className="text-right tabular-nums">{done ? `${rows.filter((r) => r.grade).length} / ${rows.length}` : '—'}</TD>
                <TD className="text-right">{!done ? <Button size="sm" variant="outline" onClick={() => setConfirm(c.id)}><CalendarX2 />End now (demo)</Button> : null}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title="End this course now?" description="Demo shortcut: sets the end date to yesterday." footer={<>
        <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
        <Button onClick={() => { actions.setCourseEndDate(confirm!, format(new Date(now.getTime() - 864e5), 'yyyy-MM-dd')); toast({ title: 'Course ended', body: 'Students were asked to evaluate SI and report their grade.' }); setConfirm(null); }}>End course</Button></>}>
        <p className="text-sm text-muted">Upcoming SI sessions after the end date are cancelled. Students get the evaluation and weekly grade reminders. No grades exist yet, so the correlation fills in as students respond.</p>
      </Dialog>
    </Card>
  );
}
