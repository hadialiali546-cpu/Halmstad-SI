import { useEffect, useState } from 'react';
import { FileDown, FileSpreadsheet, RefreshCw, Save, Send, CheckCircle2, Undo2, AlertTriangle, History } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useStore } from '@/data/store';
import { useMe } from '@/lib/hooks';
import { attendanceMap, courseName, monthLabel, reportHours, userName } from '@/data/calc';
import type { CoachReportMetrics, DB, LeaderReportMetrics, MonthlyReport } from '@/data/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea, Field } from '@/components/ui/form';
import { Dialog } from '@/components/ui/dialog';
import { ReportStatusBadge, AutomationNote } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { exportPDF, exportXLSX, type PdfSection } from '@/lib/files';
import { fmtDate, fmtDateTime, fmtDay, fmtTime } from '@/lib/utils';
import { useT } from '@/lib/i18n';

function metricCards(r: MonthlyReport): [string, string | number][] {
  if (r.metrics.kind === 'leader') {
    const m = r.metrics;
    return [
      ['Sessions completed', m.sessionsCompleted], ['Session hours', m.sessionHours], ['Total attendance', m.totalAttendance],
      ['Avg. attendance / session', m.avgAttendance], ['Compensable hours (claimed)', reportHours(r)],
    ];
  }
  const m = r.metrics;
  return [
    ['Observations completed', m.observationsCompleted], ['EDU activities led', m.eduActivities], ['Surveys sent', m.surveysSent],
    ['SI leaders supported', m.leadersSupported], ['Compensable hours (claimed)', reportHours(r)],
  ];
}

export function reportSections(db: DB, r: MonthlyReport): PdfSection[] {
  const att = attendanceMap(db);
  const sections: PdfSection[] = [
    { heading: 'Summary', table: { head: ['Measure', 'Value'], body: metricCards(r).map(([k, v]) => [k, v]) } },
  ];
  if (r.metrics.kind === 'leader') {
    sections.unshift({ heading: 'Assigned courses', text: r.metrics.courseIds.map((c) => courseName(db, c)).join(', ') });
    sections.push({
      heading: 'Sessions included',
      table: {
        head: ['Date', 'Course', 'Topic', 'Duration (h)', 'Attendance'],
        body: r.metrics.sessionIds.map((id) => {
          const s = db.sessions.find((x) => x.id === id);
          return s ? [fmtDay(s.start) + ' ' + fmtTime(s.start), courseName(db, s.courseId), s.topic, s.durationMin / 60, att.get(id)?.count ?? '—'] : [id, '', '', '', ''];
        }),
      },
    });
  } else {
    const m = r.metrics as CoachReportMetrics;
    sections.push({
      heading: 'Observations included',
      table: {
        head: ['Date', 'SI leader', 'Observation', 'Course'],
        body: m.observationIds.map((id) => {
          const o = db.observations.find((x) => x.id === id);
          return o ? [o.date ? fmtDate(o.date) : '', userName(db, o.leaderId), `Observation ${o.number}`, courseName(db, o.courseId)] : [id, '', '', ''];
        }),
      },
    });
  }
  sections.push({ heading: 'Work time by category', table: { head: ['Category', 'Hours', 'Details'], body: [...r.lines.map((l) => [l.category, l.hours, l.detail]), ['Total', reportHours(r), '']] } });
  sections.push({ heading: 'Notes', text: r.notes });
  sections.push({ heading: 'Reflections', text: r.reflections });
  if (r.supervisorComment) sections.push({ heading: 'Supervisor comment', text: r.supervisorComment });
  return sections;
}

export function exportReport(db: DB, r: MonthlyReport, kind: 'pdf' | 'xlsx') {
  const owner = userName(db, r.ownerId);
  const title = `${r.role === 'leader' ? 'SI Leader' : 'SI Coach'} monthly report — ${monthLabel(r.month)}`;
  const file = `SI-report-${owner.replace(/\s+/g, '-')}-${r.month}`;
  const sections = reportSections(db, r);
  if (kind === 'pdf') exportPDF(title, `${owner} · Status: ${r.status} · Fictional demo data`, sections, `${file}.pdf`);
  else
    exportXLSX(
      sections.filter((s) => s.table).map((s) => ({
        name: s.heading,
        headers: s.table!.head,
        rows: s.table!.body.map((row) => Object.fromEntries(s.table!.head.map((h, i) => [h, row[i]]))),
        note: `${title} · ${owner} · fictional demo data`,
      })),
      `${file}.xlsx`,
    );
}

export function ReportView({ report, mode }: { report: MonthlyReport; mode: 'owner' | 'supervisor' }) {
  const { db, actions } = useStore();
  const toast = useToast();
  const { t } = useT();
  const [notes, setNotes] = useState(report.notes);
  const [refl, setRefl] = useState(report.reflections);
  const [returnOpen, setReturnOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [commentErr, setCommentErr] = useState('');
  useEffect(() => { setNotes(report.notes); setRefl(report.reflections); }, [report.id, report.notes, report.reflections]);

  const editable = mode === 'owner' && (report.status === 'draft' || report.status === 'returned');
  const dirty = notes !== report.notes || refl !== report.reflections;
  const att = attendanceMap(db);
  const { id: supervisorId } = useMe();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">{report.role === 'leader' ? 'SI Leader report' : 'SI Coach report'}</p>
            <CardTitle className="text-lg">{monthLabel(report.month)} · {userName(db, report.ownerId)}</CardTitle>
            <CardDescription>
              Generated automatically {fmtDateTime(report.generatedAt)}
              {report.submittedAt ? ` · submitted ${fmtDateTime(report.submittedAt)}` : ''}
              {report.metrics.kind === 'leader' ? ` · Courses: ${(report.metrics as LeaderReportMetrics).courseIds.map((c) => courseName(db, c)).join(', ')}` : ''}
            </CardDescription>
          </div>
          <ReportStatusBadge status={report.status} />
        </CardHeader>
        <CardContent className="space-y-5">
          {report.status === 'returned' && report.supervisorComment ? (
            <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger-bg p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <div><p className="font-medium text-danger">Returned for correction by {userName(db, report.decidedById ?? '')}</p><p className="text-slate-700">{report.supervisorComment}</p></div>
            </div>
          ) : null}
          {report.status === 'approved' ? (
            <div className="flex gap-3 rounded-lg border border-success/30 bg-success-bg p-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <p className="text-slate-700">Approved by {userName(db, report.decidedById ?? '')} on {fmtDate(report.decidedAt!)}. Hours are eligible for administrative export.</p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {metricCards(report).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-canvas p-3">
                <p className="text-xs text-muted">{k}</p>
                <p className="text-xl font-semibold tabular-nums text-navy">{v}</p>
              </div>
            ))}
          </div>

          {report.metrics.kind === 'leader' ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-navy">Sessions included ({report.metrics.sessionIds.length})</p>
              <div className="rounded-lg border border-border">
                <Table>
                  <THead><TR><TH>Date</TH><TH>Course</TH><TH className="hidden sm:table-cell">Topic</TH><TH className="text-right">Hours</TH><TH className="text-right">Attendance</TH></TR></THead>
                  <TBody>
                    {report.metrics.sessionIds.map((id) => {
                      const s = db.sessions.find((x) => x.id === id);
                      if (!s) return null;
                      return (
                        <TR key={id}>
                          <TD className="whitespace-nowrap">{fmtDay(s.start)}, {fmtTime(s.start)}</TD>
                          <TD>{courseName(db, s.courseId)}</TD>
                          <TD className="hidden sm:table-cell">{s.topic}</TD>
                          <TD className="text-right tabular-nums">{(s.durationMin / 60).toFixed(2).replace(/\.?0+$/, '')}</TD>
                          <TD className="text-right font-medium tabular-nums">{att.get(id)?.count ?? '—'}</TD>
                        </TR>
                      );
                    })}
                    {!report.metrics.sessionIds.length ? <TR><TD colSpan={5} className="text-center text-muted">No completed sessions with registered attendance in this month.</TD></TR> : null}
                  </TBody>
                </Table>
              </div>
            </div>
          ) : (
            <CoachDetails m={report.metrics as CoachReportMetrics} />
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-navy">Work time by category</p>
            <div className="rounded-lg border border-border">
              <Table>
                <THead><TR><TH>Category</TH><TH>Details</TH><TH className="text-right">Hours</TH></TR></THead>
                <TBody>
                  {report.lines.map((l, i) => <TR key={i}><TD className="font-medium">{l.category}</TD><TD className="text-muted">{l.detail}</TD><TD className="text-right tabular-nums">{l.hours}</TD></TR>)}
                  <TR className="bg-muted-bg/50"><TD className="font-semibold text-navy">Total compensable time</TD><TD /><TD className="text-right font-semibold tabular-nums text-navy">{reportHours(report)}</TD></TR>
                </TBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted">Session duration is not the same as compensable working time. Preparation and other time follow demo rules that would be replaced by approved university rules.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Notes" htmlFor={`notes-${report.id}`}>
              <Textarea id={`notes-${report.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} placeholder="Practical notes about the month…" />
            </Field>
            <Field label="Reflections" htmlFor={`refl-${report.id}`}>
              <Textarea id={`refl-${report.id}`} value={refl} onChange={(e) => setRefl(e.target.value)} disabled={!editable} placeholder="What worked well? What will you change?" />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {mode === 'owner' ? (
              <>
                {editable ? (
                  <>
                    <Button variant="outline" onClick={() => { actions.generateReport(report.ownerId, report.month); toast({ title: 'Figures refreshed', body: 'The report now reflects the latest recorded activities.', tone: 'info' }); }}><RefreshCw />Refresh figures</Button>
                    <Button variant="outline" disabled={!dirty} onClick={() => { actions.saveReportText(report.id, notes, refl); toast({ title: 'Draft saved' }); }}><Save />{t('Save Draft')}</Button>
                    <Button
                      variant="teal"
                      onClick={() => {
                        if (dirty) actions.saveReportText(report.id, notes, refl);
                        actions.submitReport(report.id);
                        toast({ title: 'Report submitted', body: 'Your supervisor has received the report for review.' });
                      }}
                    >
                      <Send />{t('Submit to Supervisor')}
                    </Button>
                  </>
                ) : null}
              </>
            ) : report.status === 'submitted' ? (
              <>
                <Button variant="success" onClick={() => { actions.decideReport(report.id, supervisorId, 'approved'); toast({ title: 'Report approved', body: 'The hours are now available for payroll export.' }); }}><CheckCircle2 />{t('Approve')}</Button>
                <Button variant="outline" onClick={() => setReturnOpen(true)}><Undo2 />{t('Request Correction')}</Button>
              </>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exportReport(db, report, 'pdf')}><FileDown />{t('Export PDF')}</Button>
              <Button variant="outline" onClick={() => exportReport(db, report, 'xlsx')}><FileSpreadsheet />{t('Export Excel')}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-4 text-muted" />Report history</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2.5 border-l border-border pl-4">
            {[...report.history].reverse().slice(0, 8).map((h, i) => (
              <li key={i} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-teal" />
                <span className="font-medium capitalize text-navy">{h.action}</span> <span className="text-muted">by {h.byId === report.ownerId ? userName(db, h.byId) : userName(db, h.byId)} · {fmtDateTime(h.at)}</span>
                {h.comment ? <p className="text-slate-600">“{h.comment}”</p> : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Dialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        title="Request correction"
        description="The report is returned to its owner with your comment."
        footer={<>
          <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (comment.trim().length < 5) return setCommentErr('A comment explaining the correction is required.');
              actions.decideReport(report.id, supervisorId, 'returned', comment.trim());
              setReturnOpen(false); setComment(''); setCommentErr('');
              toast({ title: 'Report returned', body: `${userName(db, report.ownerId)} has been notified.`, tone: 'info' });
            }}
          >Return report</Button>
        </>}
      >
        <Field label="Comment (required)" htmlFor="return-comment" error={commentErr}>
          <Textarea id="return-comment" value={comment} onChange={(e) => { setComment(e.target.value); setCommentErr(''); }} placeholder="Explain what needs to be corrected…" />
        </Field>
      </Dialog>
    </div>
  );
}

function CoachDetails({ m }: { m: CoachReportMetrics }) {
  const { db } = useStore();
  const obs = m.observationIds.map((id) => db.observations.find((o) => o.id === id)).filter(Boolean);
  const edu = m.eduIds.map((id) => db.eduActivities.find((o) => o.id === id)).filter(Boolean);
  const surveys = m.surveyIds.map((id) => db.surveys.find((o) => o.id === id)).filter(Boolean);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-sm font-semibold text-navy">Observations ({obs.length})</p>
        {obs.length ? obs.map((o) => <p key={o!.id} className="text-sm text-slate-700">{userName(db, o!.leaderId)} · Obs. {o!.number} <span className="text-muted">({o!.date ? fmtDate(o!.date) : ''})</span></p>) : <p className="text-sm text-muted">None this month</p>}
      </div>
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-sm font-semibold text-navy">EDU activities ({edu.length})</p>
        {edu.length ? edu.map((e) => <p key={e!.id} className="text-sm text-slate-700">{e!.title} <span className="text-muted">({fmtDate(parseISO(e!.start))})</span></p>) : <p className="text-sm text-muted">None this month</p>}
      </div>
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-sm font-semibold text-navy">Surveys ({surveys.length})</p>
        {surveys.length ? surveys.map((s) => <p key={s!.id} className="text-sm text-slate-700">{s!.title} <span className="text-muted">({s!.responses.length} responses)</span></p>) : <p className="text-sm text-muted">None this month</p>}
      </div>
      <AutomationNote className="md:col-span-3">Observations, EDU activities and surveys are collected automatically from the coach’s records — no manual copying.</AutomationNote>
    </div>
  );
}
