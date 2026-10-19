import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileDown, Info, ShieldAlert, PenLine, FileText, SearchCheck, CheckCircle2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useStore } from '@/data/store';
import { monthLabel, userName, round1 } from '@/data/calc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { PageHeader, ReportStatusBadge, StatCard, AutomationNote } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { exportCSV, exportXLSX } from '@/lib/files';
import { approvedLines } from '@/lib/exports';

const LABEL = 'Demo export format — not validated for Primula import.';

export function SupPayroll() {
  const { db, now } = useStore();
  const toast = useToast();
  const months = Array.from(new Set(db.reports.map((r) => r.month))).sort().reverse();
  const [period, setPeriod] = useState('all');
  const [roleF, setRoleF] = useState('all');
  const records = useMemo(() => db.reports
    .filter((r) => r.status !== 'draft' && (period === 'all' || r.month === period) && (roleF === 'all' || r.role === roleF))
    .flatMap((r) => r.lines.map((l, i) => ({ key: `${r.id}-${i}`, r, l })))
    .sort((a, b) => b.r.month.localeCompare(a.r.month) || userName(db, a.r.ownerId).localeCompare(userName(db, b.r.ownerId))), [db, period, roleF]);
  const approved = records.filter((x) => x.r.status === 'approved');
  const approvedHours = round1(approved.reduce((n, x) => n + x.l.hours, 0));
  const pendingHours = round1(records.filter((x) => x.r.status === 'submitted').reduce((n, x) => n + x.l.hours, 0));

  const exportRows = () => approvedLines(db).filter((r) => (period === 'all' || r.period === period) && (roleF === 'all' || (roleF === 'leader' ? r.role === 'SI Leader' : r.role === 'SI Coach')))
    .map((r) => ({ 'Employee name': r.employee, Email: r.email, Role: r.role, 'Reporting period': r.period, 'Work category': r.category, 'Recorded hours': r.hours, 'Approval status': 'Approved', 'Approved by': r.approvedBy, 'Approval date': r.approvedAt }));

  const doExport = (kind: 'xlsx' | 'csv') => {
    const rows = exportRows();
    if (!rows.length) return toast({ title: 'Nothing to export', body: 'There are no approved records for this selection.', tone: 'warning' });
    const file = `si-approved-records-DEMO-${period === 'all' ? 'all' : period}-${format(now, 'yyyyMMdd')}`;
    if (kind === 'xlsx') exportXLSX([{ name: 'Approved records', rows, note: LABEL }], `${file}.xlsx`);
    else exportCSV(rows, `${file}.csv`, undefined, LABEL);
    toast({ title: 'Approved records exported', body: `${rows.length} lines · ${LABEL}` });
  };

  const steps = [
    { icon: PenLine, t: 'Work recorded', d: 'SI leader or coach records activities' },
    { icon: FileText, t: 'Report generated', d: 'Monthly report drafted automatically' },
    { icon: SearchCheck, t: 'Supervisor review', d: 'Approve or return with comment' },
    { icon: CheckCircle2, t: 'Approved', d: 'Only approved lines become eligible' },
    { icon: Download, t: 'Export', d: 'Payroll-ready administrative file' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll & Primula Export" description="Simulated workflow showing how verified SI activities could be organised into a payroll-ready administrative export." />
      <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-bg/70 p-4 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="text-slate-700">
          <p className="font-semibold text-navy">Simulation only — no connection to Primula</p>
          <p>{LABEL} Actual payroll submissions remain outside this demo and must follow the university’s established procedures.</p>
        </div>
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-5">
          {steps.map((s, i) => (
            <div key={s.t} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 ? <span className="absolute left-[calc(50%+24px)] top-5 hidden h-px w-[calc(100%-48px)] bg-border sm:block" /> : null}
              <span className="grid size-10 place-items-center rounded-full bg-teal-50 text-teal-700"><s.icon className="size-5" /></span>
              <p className="mt-2 text-sm font-medium text-navy">{i + 1}. {s.t}</p>
              <p className="text-xs text-muted">{s.d}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Approved hours (eligible)" value={approvedHours} tone="success" />
        <StatCard label="Hours awaiting approval" value={pendingHours} tone="warning" />
        <StatCard label="Approved reports" value={new Set(approved.map((x) => x.r.id)).size} />
        <StatCard label="Employees with approved hours" value={new Set(approved.map((x) => x.r.ownerId)).size} tone="teal" />
      </div>
      <Card>
        <CardHeader>
          <div><CardTitle>Recorded working hours</CardTitle><CardDescription>Submitted, approved and returned reports. Drafts are not shown.</CardDescription></div>
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Reporting period" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40"><option value="all">All periods</option>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select>
            <Select aria-label="Role" value={roleF} onChange={(e) => setRoleF(e.target.value)} className="w-36"><option value="all">All roles</option><option value="leader">SI leaders</option><option value="coach">SI coaches</option></Select>
            <Button variant="outline" onClick={() => doExport('csv')}><FileDown />CSV</Button>
            <Button onClick={() => doExport('xlsx')}><FileSpreadsheet />Export Approved Records</Button>
          </div>
        </CardHeader>
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <THead><TR><TH>Employee name</TH><TH>Role</TH><TH>Reporting period</TH><TH>Work category</TH><TH className="text-right">Recorded hours</TH><TH>Approval status</TH></TR></THead>
            <TBody>
              {records.map(({ key, r, l }) => (
                <TR key={key} className={r.status === 'approved' ? '' : 'text-slate-500'}>
                  <TD className="font-medium text-navy">{userName(db, r.ownerId)}</TD>
                  <TD>{r.role === 'leader' ? 'SI Leader' : 'SI Coach'}</TD>
                  <TD>{monthLabel(r.month)}</TD>
                  <TD>{l.category}</TD>
                  <TD className="text-right tabular-nums">{l.hours}</TD>
                  <TD><ReportStatusBadge status={r.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
      <AutomationNote>Approved reports become eligible for administrative export. Submitted or returned reports are visible here but are never included in the export file.</AutomationNote>
      <p className="flex items-center gap-1.5 text-xs text-muted"><Info className="size-3.5" />Hours follow demo rules (e.g. 1 h preparation per delivered session). Real compensation rules would be configured with HR/payroll.</p>
    </div>
  );
}
