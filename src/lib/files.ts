// File generation helpers: CSV, Excel (SheetJS), ICS calendar, PDF (jsPDF).
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addMinutes, format, parseISO } from 'date-fns';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type Row = Record<string, string | number>;

export function toCSV(rows: Row[], headers?: string[]): string {
  const cols = headers ?? (rows[0] ? Object.keys(rows[0]) : []);
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function exportCSV(rows: Row[], filename: string, headers?: string[], preamble?: string) {
  const body = toCSV(rows, headers);
  const text = (preamble ? `# ${preamble}\n` : '') + body;
  downloadBlob(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }), filename);
}

export function exportXLSX(sheets: { name: string; rows: Row[]; headers?: string[]; note?: string }[], filename: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const aoa: (string | number)[][] = [];
    if (s.note) aoa.push([s.note], []);
    const cols = s.headers ?? (s.rows[0] ? Object.keys(s.rows[0]) : []);
    aoa.push(cols);
    s.rows.forEach((r) => aoa.push(cols.map((c) => r[c] ?? '')));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = cols.map((c) => ({ wch: Math.max(12, c.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd hh:mm' });
}

export function downloadICS(ev: { id: string; title: string; start: string; durationMin: number; location: string; description: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = parseISO(ev.start);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Halmstad SI Concept Demo//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.id}@halmstad-si-demo`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(start)}`,
    `DTEND:${f(addMinutes(start, ev.durationMin))}`,
    `SUMMARY:${ev.title.replace(/[,;]/g, ' ')}`,
    `LOCATION:${ev.location.replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:${ev.description.replace(/\n/g, '\\n').replace(/[,;]/g, ' ')}`,
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:SI session reminder', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  downloadBlob(new Blob([lines.join('\r\n')], { type: 'text/calendar' }), `si-session-${format(start, 'yyyy-MM-dd')}.ics`);
}

export interface PdfSection {
  heading: string;
  text?: string;
  table?: { head: string[]; body: (string | number)[][] };
}

export function exportPDF(title: string, subtitle: string, sections: PdfSection[], filename: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(18, 48, 74);
  doc.rect(0, 0, W, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(title, 40, 32);
  doc.setFontSize(10);
  doc.text(subtitle, 40, 52);
  doc.setTextColor(30, 41, 59);
  let y = 95;
  sections.forEach((s) => {
    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(s.heading, 40, y);
    doc.setFont('helvetica', 'normal');
    y += 14;
    if (s.text !== undefined) {
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(s.text || '—', W - 80);
      doc.text(lines, 40, y);
      y += lines.length * 13 + 12;
    }
    if (s.table) {
      autoTable(doc, {
        startY: y, head: [s.table.head], body: s.table.body, margin: { left: 40, right: 40 },
        styles: { fontSize: 9 }, headStyles: { fillColor: [0, 141, 149] },
      });
      // @ts-expect-error lastAutoTable is added by the plugin
      y = (doc.lastAutoTable?.finalY ?? y) + 22;
    }
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Halmstad SI — Concept Demo · fictional data · generated ' + format(new Date(), 'yyyy-MM-dd HH:mm'), 40, 820);
  }
  doc.save(filename);
}

export interface CalEvent { id: string; title: string; start: string; durationMin: number; location: string; description: string; kind: 'session' | 'edu' | 'observation' }

/** Multi-event iCalendar file (RFC 5545) — importable into Outlook, Google and Apple Calendar */
export function buildICS(events: CalEvent[], calName: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const clean = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Halmstad SI Concept Demo//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${clean(calName)}`];
  events.forEach((ev) => {
    const start = parseISO(ev.start);
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@halmstad-si-demo`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(addMinutes(start, ev.durationMin))}`,
      `SUMMARY:${clean(ev.title)}`, `LOCATION:${clean(ev.location)}`, `DESCRIPTION:${clean(ev.description)}`, `CATEGORIES:${ev.kind.toUpperCase()}`,
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${clean(ev.title)}`, 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
export function downloadCalendar(events: CalEvent[], calName: string, filename: string) {
  downloadBlob(new Blob([buildICS(events, calName)], { type: 'text/calendar' }), filename);
}
