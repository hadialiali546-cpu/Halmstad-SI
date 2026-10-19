import { useMemo } from 'react';
import { useRole } from '@/components/layout/AppShell';
import { useIdentity } from '@/backend/identity';
import { useStore } from '@/data/store';
import { attendanceMap } from '@/data/calc';

export function useMe() {
  const role = useRole();
  const { db } = useStore();
  const { personaFor } = useIdentity();
  const id = personaFor(role);
  const user = db.users.find((u) => u.id === id) ?? { id, name: 'Unknown user', email: '', role };
  return { role, id, user };
}

export function useAttendance() {
  const { db } = useStore();
  return useMemo(() => attendanceMap(db), [db]);
}
