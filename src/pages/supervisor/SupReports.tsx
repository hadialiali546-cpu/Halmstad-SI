import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { useStore } from '@/data/store';
import { monthLabel, reportHours, userName } from '@/data/calc';
import type { ReportStatus } from '@/data/types';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form';
import { PageHeader, ReportStatusBadge, Tabs, AutomationNote, EmptyState } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { ReportView } from '@/components/shared/ReportView';
import { cn, fmtDate } from '@/lib/utils';

export function SupReports() {
  const { db } = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'all' | ReportStatus>('submitted');
  const [role, setRole] = useState('all');
  const [month, setMonth] = useState('all');
  const [q, setQ] = useState('');
  const openId = params.get('open');
  const selected = db.reports.find((r) => r.id === openId);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthsAvail = Array.from(new Set(db.reports.map((r) => r.month))).sort().reverse();
  const count = (s: ReportStatus) => db.reports.filter((r) => r.status === s).length;
  const list = db.reports
    .filter((r) => (tab === 'all' || r.status === tab) && (role === 'all' || r.role === role) && (month === 'all' || r.month === month) && userName(db, r.ownerId).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.submittedAt ?? b.generatedAt).localeCompare(a.submittedAt ?? a.generatedAt));

  return (
    <div className="space-y-5">
      <PageHeader title="Reports & Approvals" description="Monthly reports from SI leaders and coaches. Submitted reports are never approved automatically." />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'submitted', label: 'Awaiting approval', count: count('submitted') },
          { value: 'approved', label: 'Approved', count: count('approved') },
          { value: 'returned', label: 'Returned', count: count('returned') },
          { value: 'draft', label: 'Draft', count: count('draft') },
          { value: 'all', label: 'All', count: db.reports.length },
        ]} />
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="w-36"><option value="all">All roles</option><option value="leader">SI leaders</option><option value="coach">SI coaches</option></Select>
          <Select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40"><option value="all">All months</option>{monthsAvail.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select>
          <div className="relative w-48"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input aria-label="Search by name" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name" className="pl-9" /></div>
        </div>
      </div>
      {list.length === 0 ? <EmptyState title="No reports" body={tab === 'submitted' ? 'Nothing is awaiting approval right now.' : 'No reports match these filters.'} /> : (
        <Card>
          <Table>
            <THead><TR><TH>Report owner</TH><TH>Role</TH><TH>Reporting month</TH><TH className="hidden md:table-cell">Submitted</TH><TH className="hidden text-right sm:table-cell">Hours</TH><TH>Status</TH><TH /></TR></THead>
            <TBody>
              {list.map((r) => (
                <TR key={r.id} className={cn('cursor-pointer', r.id === openId && 'bg-teal-50/60')} onClick={() => setParams({ open: r.id })}>
                  <TD className="font-medium text-navy">{userName(db, r.ownerId)}</TD>
                  <TD>{r.role === 'leader' ? 'SI Leader' : 'SI Coach'}</TD>
                  <TD>{monthLabel(r.month)}</TD>
                  <TD className="hidden md:table-cell">{r.submittedAt ? fmtDate(r.submittedAt) : '—'}</TD>
                  <TD className="hidden text-right tabular-nums sm:table-cell">{reportHours(r)}</TD>
                  <TD><ReportStatusBadge status={r.status} /></TD>
                  <TD><ChevronRight className="size-4 text-muted" /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
      <AutomationNote>Approved reports become eligible for administrative export (Payroll &amp; Primula Export).</AutomationNote>
      <div ref={detailRef} className="scroll-mt-20">
        {selected ? <ReportView report={selected} mode="supervisor" /> : null}
      </div>
    </div>
  );
}
