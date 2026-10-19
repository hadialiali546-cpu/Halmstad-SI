import { useState, type ReactNode } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { useStore } from '@/data/store';
import { findReport, monthKey, monthLabel, reportHours } from '@/data/calc';
import { useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { PageHeader, ReportStatusBadge, AutomationNote, EmptyState } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { ReportView } from '@/components/shared/ReportView';
import { useToast } from '@/components/ui/toast';
import { fmtDate } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function MonthlyReportsPage({ kind, renderExtra }: { kind: 'leader' | 'coach'; renderExtra?: (month: string) => ReactNode }) {
  const { db, actions, now } = useStore();
  const { id } = useMe();
  const toast = useToast();
  const { t } = useT();
  const months = [0, 1, 2].map((i) => monthKey(subMonths(now, i)));
  const [month, setMonth] = useState(months[0]);
  const report = findReport(db, id, month);
  const mine = db.reports.filter((r) => r.ownerId === id).sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Reports"
        description={kind === 'leader'
          ? 'Your monthly report is drafted automatically from registered sessions and attendance. You only add notes and reflections.'
          : 'Your coaching report is drafted automatically from observations, EDU activities, surveys and registered work.'}
        actions={<>
          <Select aria-label="Reporting month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </Select>
          {!report || report.status === 'draft' || report.status === 'returned' ? (
            <Button variant="teal" onClick={() => { actions.generateReport(id, month); toast({ title: report ? 'Report refreshed' : 'Report generated', body: `Draft for ${monthLabel(month)} created from your recorded activities.` }); }}>
              <Sparkles />{report ? 'Regenerate figures' : t('Generate Monthly Report')}
            </Button>
          ) : null}
        </>}
      />
      {report ? <ReportView report={report} mode="owner" /> : (
        <Card>
          <CardContent className="pt-5">
            <EmptyState
              icon={FileText}
              title={`No report for ${monthLabel(month)} yet`}
              body="Click “Generate Monthly Report” to create a draft from your recorded activities. Nothing is sent until you submit."
              action={<Button variant="teal" onClick={() => actions.generateReport(id, month)}><Sparkles />{t('Generate Monthly Report')}</Button>}
            />
            <AutomationNote className="mt-4">{kind === 'leader' ? 'Attendance automatically updates course statistics and monthly reports.' : 'Observations automatically contribute to the coach’s reporting record.'}</AutomationNote>
          </CardContent>
        </Card>
      )}
      {renderExtra ? renderExtra(month) : null}
      <Card>
        <CardHeader><CardTitle>All my reports</CardTitle></CardHeader>
        {mine.length ? (
          <Table>
            <THead><TR><TH>Month</TH><TH>Status</TH><TH className="hidden sm:table-cell">Submitted</TH><TH className="text-right">Hours</TH><TH /></TR></THead>
            <TBody>
              {mine.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium text-navy">{monthLabel(r.month)}</TD>
                  <TD><ReportStatusBadge status={r.status} /></TD>
                  <TD className="hidden sm:table-cell">{r.submittedAt ? fmtDate(r.submittedAt) : '—'}</TD>
                  <TD className="text-right tabular-nums">{reportHours(r)}</TD>
                  <TD className="text-right"><Button size="sm" variant="ghost" onClick={() => { if (!months.includes(r.month)) return; setMonth(r.month); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Open</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : <CardContent><p className="text-sm text-muted">No reports yet.</p></CardContent>}
      </Card>
      <p className="text-xs text-muted">Reports are not approved automatically on submission. Only reports approved by a supervisor become eligible for administrative (payroll) export. Today: {format(now, 'd MMM yyyy')}.</p>
    </div>
  );
}

export const LeaderReports = () => <MonthlyReportsPage kind="leader" />;
