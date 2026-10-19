import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { QrCode, Users, Wand2, Lock, ArrowRight } from 'lucide-react';
import { useStore } from '@/data/store';
import { courseName, studentsOfCourse, userName } from '@/data/calc';
import type { SISession } from '@/data/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AutomationNote, Avatar, Progress } from '@/components/ui/misc';
import { fmtDay, fmtTime } from '@/lib/utils';

/** Check-in URL encoded in the QR code. In production this would be a public HTTPS URL. */
export const checkinUrl = (s: SISession) =>
  `${window.location.origin}${window.location.pathname}#/student/checkin/${s.id}?code=${s.checkin?.code ?? ''}`;

export function CheckinPanel({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const { db, actions } = useStore();
  const navigate = useNavigate();
  const s = db.sessions.find((x) => x.id === sessionId);
  const [qr, setQr] = useState('');
  const open = !!s?.checkin && !s.checkin.closedAt;

  useEffect(() => {
    if (!s?.checkin) return;
    QRCode.toDataURL(checkinUrl(s), { margin: 1, width: 480, color: { dark: '#12304A', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(''));
  }, [s?.id, s?.checkin?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;
  const roster = studentsOfCourse(db, s.courseId);
  const checked = s.checkin?.studentIds ?? [];

  return (
    <Dialog
      open={!!sessionId}
      onOpenChange={(o) => !o && onClose()}
      wide
      title="QR check-in"
      description={`${courseName(db, s.courseId)} · ${fmtDay(s.start)}, ${fmtTime(s.start)} · ${s.location}`}
      footer={!s.checkin ? (
        <><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="teal" onClick={() => actions.openCheckin(s.id)}><QrCode />Start check-in</Button></>
      ) : open ? (
        <>
          <Button variant="ghost" onClick={() => actions.simulateCheckins(s.id, 4)}><Wand2 />Simulate students scanning (demo)</Button>
          <Button onClick={() => { actions.closeCheckin(s.id); }}><Lock />Close check-in</Button>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={() => actions.openCheckin(s.id)}>Reopen</Button>
          <Button variant="teal" onClick={() => { onClose(); navigate(`/leader/attendance?session=${s.id}`); }}>Review attendance register <ArrowRight /></Button>
        </>
      )}
    >
      {!s.checkin ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>Show a QR code on the screen at the start of the session. Students scan it with their phone (or type the 4-digit code) and are checked in by name.</p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>Only students registered on the course can check in.</li>
            <li>When you close check-in, the names pre-fill the attendance register — you just review and save.</li>
          </ul>
          <AutomationNote>QR check-in replaces paper lists and manual counting.</AutomationNote>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center rounded-xl border border-border bg-white p-4">
            {qr ? <img src={qr} alt={`QR code for check-in, code ${s.checkin.code}`} className={`size-56 ${open ? '' : 'opacity-30 grayscale'}`} /> : <div className="size-56 animate-pulse rounded bg-muted-bg" />}
            <p className="mt-3 text-xs uppercase tracking-wider text-muted">or enter code</p>
            <p className="font-mono text-4xl font-semibold tracking-[0.3em] text-navy" data-testid="checkin-code">{s.checkin.code}</p>
            <Badge tone={open ? 'success' : 'neutral'} className="mt-2">{open ? 'Check-in open' : 'Check-in closed'}</Badge>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-navy"><Users className="size-4" />Checked in</p>
              <p className="text-sm tabular-nums text-muted" data-testid="checkin-count">{checked.length} / {roster.length}</p>
            </div>
            <Progress value={(checked.length / Math.max(1, roster.length)) * 100} />
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto" aria-live="polite">
              {[...checked].reverse().map((id) => (
                <div key={id} className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5 text-sm">
                  <Avatar name={userName(db, id)} className="size-6 text-[10px]" />{userName(db, id)}
                </div>
              ))}
              {!checked.length ? <p className="py-6 text-center text-sm text-muted">Waiting for students…</p> : null}
            </div>
            <p className="mt-3 text-xs text-muted">Demo: as Student (Emma Andersson) open the Overview and enter the code to check in yourself.</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
