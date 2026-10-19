import { useMemo, useRef, useState } from 'react';
import { Upload, FileDown, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Settings2 } from 'lucide-react';
import { format, isValid, parse } from 'date-fns';
import { useStore, type ImportRow } from '@/data/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Label } from '@/components/ui/form';
import { PageHeader, AutomationNote, EmptyState } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { exportCSV, exportXLSX, readSheet } from '@/lib/files';
import { applyColumns, configuredColumns, DATASETS, TEMPLATE_HEADERS, templateRows } from '@/lib/exports';
import type { ExportColumnConfig } from '@/data/types';

interface Preview { row: number; raw: Record<string, string>; parsed?: ImportRow; errors: string[]; warnings: string[] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const ALIASES: Record<keyof ImportRow, string[]> = {
  name: ['name', 'namn'], role: ['role', 'roll'], courseCode: ['coursecode', 'kurskod'], courseName: ['coursename', 'kursnamn'],
  sessionDate: ['sessiondate', 'date', 'datum'], durationMin: ['sessionduration', 'duration', 'minutes', 'langd'], attendance: ['attendance', 'narvaro', 'antal'],
};

function parseDate(v: string): Date | null {
  const s = v.trim();
  for (const f of ['yyyy-MM-dd HH:mm', 'yyyy-MM-dd H:mm', 'yyyy-MM-dd', 'M/d/yy H:mm', 'M/d/yy HH:mm', 'M/d/yy', 'd/M/yyyy HH:mm', 'yyyy-MM-ddTHH:mm']) {
    const d = parse(s, f, new Date());
    if (isValid(d)) return d;
  }
  return null;
}

export function SupImportExport() {
  const { db, actions, now } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileErr, setFileErr] = useState('');

  const validate = (rows: Record<string, unknown>[]): Preview[] => {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]);
    const map = Object.fromEntries(
      (Object.keys(ALIASES) as (keyof ImportRow)[]).map((k) => [k, keys.find((h) => ALIASES[k].includes(norm(h)))]),
    ) as Record<keyof ImportRow, string | undefined>;
    const seen = new Set<string>();
    const att = new Set(db.sessions.map((s) => `${s.leaderId}|${s.courseId}|${format(new Date(s.start), 'yyyy-MM-dd HH:mm')}`));
    return rows.map((r, i) => {
      const get = (k: keyof ImportRow) => (map[k] ? String(r[map[k]!] ?? '').trim() : '');
      const raw = Object.fromEntries(TEMPLATE_HEADERS.map((h, j) => [h, get((Object.keys(ALIASES) as (keyof ImportRow)[])[j])]));
      const errors: string[] = [];
      const warnings: string[] = [];
      const name = get('name'), role = get('role'), code = get('courseCode'), dateS = get('sessionDate'), durS = get('durationMin'), attS = get('attendance');
      if (!name) errors.push('Missing name');
      if (!code) errors.push('Missing course code');
      if (!dateS) errors.push('Missing session date');
      if (attS === '') errors.push('Missing attendance');
      if (role && !/leader|ledare/i.test(role)) errors.push('Only SI leader session rows can be imported');
      const course = db.courses.find((c) => c.code.toLowerCase() === code.toLowerCase());
      if (code && !course) errors.push(`Unknown course code “${code}”`);
      const date = dateS ? parseDate(dateS) : null;
      if (dateS && !date) errors.push('Invalid date (use yyyy-MM-dd HH:mm)');
      if (date && date > now) errors.push('Session date is in the future');
      const dur = durS ? Number(durS) : 120;
      if (!durS) warnings.push('Duration missing — 120 min assumed');
      else if (!dur || dur < 15 || dur > 480) errors.push('Duration must be 15–480 minutes');
      const a = Number(attS);
      if (attS !== '' && (!Number.isInteger(a) || a < 0)) errors.push('Attendance must be a whole number');
      const user = db.users.find((u) => u.name.toLowerCase() === name.toLowerCase());
      if (name && !user) warnings.push('New SI leader will be created');
      if (user && user.role !== 'leader') errors.push(`${name} is not an SI leader`);
      if (date && course) {
        const k = `${name.toLowerCase()}|${code.toLowerCase()}|${format(date, 'yyyy-MM-dd HH:mm')}`;
        if (seen.has(k)) errors.push('Duplicate row in file');
        seen.add(k);
        if (user && att.has(`${user.id}|${course.id}|${format(date, 'yyyy-MM-dd HH:mm')}`)) errors.push('Session already exists in the platform');
      }
      return {
        row: i + 2, raw, errors, warnings,
        parsed: errors.length ? undefined : { name, role, courseCode: code, courseName: get('courseName'), sessionDate: format(date!, 'yyyy-MM-dd HH:mm'), durationMin: dur, attendance: a },
      };
    });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileErr(''); setPreview(null); setFileName(f.name);
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return setFileErr('Please choose an .xlsx, .xls or .csv file.');
    setLoading(true);
    try {
      const rows = await readSheet(f);
      if (!rows.length) setFileErr('The file contains no data rows.');
      else setPreview(validate(rows));
    } catch {
      setFileErr('The file could not be read. Check that it is a valid spreadsheet.');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const valid = preview?.filter((p) => p.parsed) ?? [];

  // ---------- export ----------
  const [dsKey, setDsKey] = useState(DATASETS[0].key);
  const ds = DATASETS.find((d) => d.key === dsKey)!;
  const [colsEdit, setColsEdit] = useState<ExportColumnConfig[] | null>(null);
  const columns = colsEdit ?? configuredColumns(db, ds);
  const data = useMemo(() => ds.rows(db, now), [ds, db, now]);
  const out = applyColumns(data, columns);
  const doExport = (kind: 'csv' | 'xlsx') => {
    const file = `halmstad-si-${ds.key}-${format(now, 'yyyyMMdd')}`;
    if (kind === 'csv') exportCSV(out.rows, `${file}.csv`, out.headers);
    else exportXLSX([{ name: ds.name, rows: out.rows, headers: out.headers, note: `${ds.name} — Halmstad SI concept demo (fictional data), exported ${format(now, 'yyyy-MM-dd HH:mm')}` }], `${file}.xlsx`);
    toast({ title: 'Export downloaded', body: `${out.rows.length} rows · ${kind.toUpperCase()}` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Import & Export Center" description="Shows how the platform can work alongside existing university spreadsheets." />
      <Card>
        <CardHeader>
          <div><CardTitle>Import SI records</CardTitle><CardDescription>Upload an Excel or CSV file with fictional SI session records. You see a validated preview before anything is saved.</CardDescription></div>
          <Button variant="outline" onClick={() => exportXLSX([{ name: 'SI import', rows: templateRows(), headers: TEMPLATE_HEADERS }], 'halmstad-si-import-template.xlsx')}><FileDown />Download example template</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-canvas px-6 py-8 text-center transition hover:border-teal-200"
          >
            <Upload className="size-7 text-teal" />
            <p className="mt-2 text-sm font-medium text-navy">{loading ? 'Reading file…' : 'Drop a file here or click to choose'}</p>
            <p className="text-xs text-muted">.xlsx, .xls or .csv · columns: {TEMPLATE_HEADERS.join(', ')}</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose import file" />
          </label>
          <p className="text-xs text-muted">Tip: the example template intentionally contains a duplicate, an unknown course code and missing fields to demonstrate validation.</p>
          {fileErr ? <p className="flex items-center gap-2 text-sm text-danger" role="alert"><XCircle className="size-4" />{fileErr}</p> : null}
          {preview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-navy">{fileName}</span>
                <Badge tone="success">{valid.length} ready to import</Badge>
                <Badge tone="danger">{preview.length - valid.length} cannot be imported</Badge>
              </div>
              <div className="rounded-lg border border-border">
                <Table>
                  <THead><TR><TH>Row</TH>{TEMPLATE_HEADERS.map((h) => <TH key={h}>{h}</TH>)}<TH>Validation</TH></TR></THead>
                  <TBody>
                    {preview.map((p) => (
                      <TR key={p.row} className={p.errors.length ? 'bg-danger-bg/40' : ''}>
                        <TD className="text-muted">{p.row}</TD>
                        {TEMPLATE_HEADERS.map((h) => <TD key={h} className="whitespace-nowrap">{p.raw[h] || <span className="text-danger">—</span>}</TD>)}
                        <TD className="min-w-[220px]">
                          {p.errors.length ? p.errors.map((e) => <p key={e} className="flex items-center gap-1 text-xs text-danger"><XCircle className="size-3.5 shrink-0" />{e}</p>)
                            : <p className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" />Valid</p>}
                          {p.warnings.map((w) => <p key={w} className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5 shrink-0" />{w}</p>)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!valid.length} onClick={() => { const n = actions.importRows(valid.map((v) => v.parsed!)); setPreview(null); toast({ title: `${n} record(s) imported`, body: 'Sessions and attendance are now part of all statistics.' }); }}>
                  <CheckCircle2 />Import {valid.length} valid row(s)
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
              </div>
            </div>
          ) : null}
          <AutomationNote>Imported sessions are treated like registered attendance: course analytics and reports update immediately.</AutomationNote>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col"><CardTitle>Export data</CardTitle><CardDescription>Generate real downloadable CSV or Excel files. Column names are configurable so they can later match approved university templates.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {DATASETS.map((d) => (
              <button key={d.key} onClick={() => { setDsKey(d.key); setColsEdit(null); }} className={`rounded-lg border p-3 text-left transition ${d.key === dsKey ? 'border-teal bg-teal-50/60 ring-1 ring-teal' : 'border-border hover:border-teal-200'}`}>
                <p className="text-sm font-medium text-navy">{d.name}</p>
                <p className="mt-0.5 text-xs text-muted">{d.description}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy"><Settings2 className="size-4" />Columns</p>
              {columns.map((c, i) => (
                <div key={c.key} className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-teal" checked={c.include} aria-label={`Include ${c.label}`} onChange={() => setColsEdit(columns.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))} />
                  <Input aria-label={`Label for ${c.key}`} value={c.label} onChange={(e) => setColsEdit(columns.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-8" />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={!colsEdit} onClick={() => { actions.setExportConfig(ds.key, columns); setColsEdit(null); toast({ title: 'Column configuration saved' }); }}>Save configuration</Button>
                <Button size="sm" variant="ghost" onClick={() => { actions.setExportConfig(ds.key, ds.columns); setColsEdit(null); }}><RotateCcw />Defaults</Button>
              </div>
            </div>
            <div className="space-y-3 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">Preview <span className="font-normal text-muted">({out.rows.length} rows)</span></p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => doExport('csv')} disabled={!out.rows.length}><FileDown />CSV</Button>
                  <Button onClick={() => doExport('xlsx')} disabled={!out.rows.length}><FileSpreadsheet />Excel</Button>
                </div>
              </div>
              {out.rows.length ? (
                <div className="max-h-80 overflow-auto rounded-lg border border-border">
                  <Table>
                    <THead><TR>{out.headers.map((h) => <TH key={h}>{h}</TH>)}</TR></THead>
                    <TBody>{out.rows.slice(0, 12).map((r, i) => <TR key={i}>{out.headers.map((h) => <TD key={h} className="whitespace-nowrap">{String(r[h])}</TD>)}</TR>)}</TBody>
                  </Table>
                </div>
              ) : <EmptyState title="No rows" body="This dataset is currently empty." />}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="hidden"><Label>.</Label><Select /></div>
    </div>
  );
}
