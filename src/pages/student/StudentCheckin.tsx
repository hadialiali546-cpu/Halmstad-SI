import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { PageHeader, EmptyState } from '@/components/ui/misc';
import { CheckinCard } from '@/components/shared/StudentSessionActions';
import { QrCode } from 'lucide-react';

/** Page opened by scanning the QR code (code is pre-filled from the link) */
export function StudentCheckin() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const { db } = useStore();
  const s = db.sessions.find((x) => x.id === sessionId);
  const open = s?.checkin && !s.checkin.closedAt;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="SI check-in" description="Confirm your attendance for the session." />
      {open ? <CheckinCard presetCode={params.get('code') ?? ''} /> : (
        <EmptyState icon={QrCode} title="Check-in is closed" body="Ask your SI leader to open check-in, or contact them if you attended." action={<Link to="/student" className="text-sm font-medium text-teal">Go to overview</Link>} />
      )}
    </div>
  );
}
