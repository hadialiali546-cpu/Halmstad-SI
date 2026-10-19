import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { findReport, monthKey, monthLabel } from '@/data/calc';
import type { WorkCategory } from '@/data/types';
import { useMe } from '@/lib/hooks';
import { MonthlyReportsPage } from '@/pages/leader/LeaderReports';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/utils';

const CATS: WorkCategory[] = ['Meeting', 'Other', 'Survey work', 'EDU facilitation', 'Observation'];

function WorkActivities({ month }: { month: string }) {
  const { db, actions } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const rep = findReport(db, id, month);
  const locked = rep && (rep.status === 'submitted' || rep.status === 'approved');
  const items = db.workActivities.filter((w) => w.userId === id && monthKey(w.date) === month);
  const defDate = monthKey(new Date()) === month ? format(new Date(), 'yyyy-MM-dd') : `${month}-15`;
  const [f, setF] = useState({ date: defDate, category: 'Meeting' as WorkCategory, hours: '1', description: '' });
  const [err, setErr] = useState('');
  const add = () => {
    const h = Number(f.hours);
    if (!f.date || monthKey(parseISO(f.date)) !== month) return setErr(`Date must be in ${monthLabel(month)}.`);
    if (!h || h <= 0 || h > 24) return setErr('Hours must be between 0 and 24.');
    if (f.description.trim().length < 3) return setErr('Add a short description.');
    actions.addWorkActivity({ userId: id, date: f.date, category: f.category, hours: h, description: f.description.trim() });
    setF({ ...f, description: '' });
    setErr('');
    toast({ title: 'Activity registered', body: rep ? 'The report draft was updated.' : 'It will be included when you generate the report.' });
  };
  return (
    <Card>
      <CardHeader className="flex-col"><CardTitle>Other eligible coaching work — {monthLabel(month)}</CardTitle><CardDescription>Meetings and other activities not captured elsewhere. Included automatically in the report.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {!locked ? (
          <div className="grid gap-3 md:grid-cols-[150px_170px_90px_1fr_auto] md:items-end">
            <Field label="Date" htmlFor="wa-date"><Input id="wa-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Category" htmlFor="wa-cat"><Select id="wa-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as WorkCategory })}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Hours" htmlFor="wa-h"><Input id="wa-h" type="number" step={0.25} min={0.25} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></Field>
            <Field label="Description" htmlFor="wa-d"><Input id="wa-d" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Coaching meeting with Omar Hassan" /></Field>
            <Button onClick={add}><Plus />Add</Button>
          </div>
        ) : <p className="text-sm text-muted">The report for this month has been submitted; activities are locked.</p>}
        {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
        <Table>
          <THead><TR><TH>Date</TH><TH>Category</TH><TH>Description</TH><TH className="text-right">Hours</TH><TH /></TR></THead>
          <TBody>
            {items.map((w) => (
              <TR key={w.id}>
                <TD>{fmtDate(w.date)}</TD><TD>{w.category}</TD><TD>{w.description}</TD><TD className="text-right tabular-nums">{w.hours}</TD>
                <TD className="text-right">{!locked ? <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => actions.removeWorkActivity(w.id)}><Trash2 /></Button> : null}</TD>
              </TR>
            ))}
            {!items.length ? <TR><TD colSpan={5} className="text-center text-muted">No manual activities this month.</TD></TR> : null}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export const CoachReports = () => <MonthlyReportsPage kind="coach" renderExtra={(m) => <WorkActivities month={m} />} />;
