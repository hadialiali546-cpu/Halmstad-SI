// Supervisor tool (cloud mode): approve new accounts, assign roles, link accounts to person records.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserCheck, UserX, ShieldCheck } from 'lucide-react';
import { useIdentity, type Profile } from '@/backend/identity';
import { useStore } from '@/data/store';
import { courseName } from '@/data/calc';
import type { Role } from '@/data/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/form';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

const ROLE_LABEL: Record<Role, string> = { student: 'Student', leader: 'SI Leader', coach: 'SI Coach', supervisor: 'SI Supervisor' };

export function AccessRequests() {
  const { backend, profile: me } = useIdentity();
  const { db, actions } = useStore();
  const toast = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [draft, setDraft] = useState<Record<string, { role: Role; link: string; courses: string[]; allRoles: boolean }>>({});

  useEffect(() => {
    if (backend?.mode !== 'cloud') return;
    return onSnapshot(collection(backend.fs, 'profiles'), (s) => setProfiles(s.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Profile, 'uid'>) }))), () => undefined);
  }, [backend]);

  const linked = useMemo(() => new Set(profiles.filter((p) => p.userId).map((p) => p.userId)), [profiles]);
  if (backend?.mode !== 'cloud' || me?.role !== 'supervisor') return null;
  const fs = backend.fs;
  const pending = profiles.filter((p) => p.role === 'pending');
  const active = profiles.filter((p) => p.role !== 'pending');
  const d = (uid: string) => draft[uid] ?? { role: 'student' as Role, link: 'new', courses: [], allRoles: false };
  const setD = (uid: string, patch: Partial<ReturnType<typeof d>>) => setDraft({ ...draft, [uid]: { ...d(uid), ...patch } });

  const approve = async (p: Profile) => {
    const x = d(p.uid);
    let userId = x.link;
    if (x.link === 'new') {
      userId = `${x.role === 'leader' ? 'ldr' : x.role === 'coach' ? 'coa' : x.role === 'supervisor' ? 'sup' : 'stu'}-${p.uid.slice(0, 8).toLowerCase()}`;
      const newId = userId;
      actions.addPerson({ id: newId, name: p.name, email: p.email, role: x.role }, x.courses);
    }
    try {
      await updateDoc(doc(fs, 'profiles', p.uid), { role: x.role, userId, allRoles: x.allRoles });
      toast({ title: 'Access approved', body: `${p.name} is now ${ROLE_LABEL[x.role]}.` });
    } catch {
      toast({ title: 'Could not approve', body: 'Check the Firestore security rules are deployed.', tone: 'warning' });
    }
  };
  const update = (p: Profile, patch: Partial<Profile>) => updateDoc(doc(fs, 'profiles', p.uid), patch).catch(() => toast({ title: 'Update failed', tone: 'warning' }));

  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-teal" />Accounts & access</CardTitle>
        <CardDescription>People who sign up wait here until you assign a role. Link them to an existing person record (e.g. a demo persona) or create a new one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {pending.length ? pending.map((p) => {
          const x = d(p.uid);
          const candidates = db.users.filter((u) => u.role === x.role && !linked.has(u.id));
          return (
            <div key={p.uid} className="rounded-xl border border-warning/40 bg-warning-bg/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-medium text-navy">{p.name}</p><p className="text-sm text-muted">{p.email}</p></div>
                <Badge tone="warning">Waiting for approval</Badge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Select aria-label="Role" value={x.role} onChange={(e) => setD(p.uid, { role: e.target.value as Role, link: 'new' })}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
                <Select aria-label="Person record" value={x.link} onChange={(e) => setD(p.uid, { link: e.target.value })}>
                  <option value="new">Create new person record</option>
                  {candidates.map((u) => <option key={u.id} value={u.id}>Link to {u.name}{u.source === 'seed' ? ' (demo)' : ''}</option>)}
                </Select>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="size-4 accent-teal" checked={x.allRoles} onChange={(e) => setD(p.uid, { allRoles: e.target.checked })} />Can switch between all role views (demo/testing)</label>
              </div>
              {x.link === 'new' && (x.role === 'student' || x.role === 'leader') ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-sm text-muted">{x.role === 'student' ? 'Enrol on:' : 'Lead SI for:'}</span>
                  {db.courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="size-4 accent-teal" checked={x.courses.includes(c.id)} onChange={(e) => setD(p.uid, { courses: e.target.checked ? [...x.courses, c.id] : x.courses.filter((y) => y !== c.id) })} />{courseName(db, c.id)}</label>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => approve(p)}><UserCheck />Approve</Button>
              </div>
            </div>
          );
        }) : <p className="text-sm text-muted">No pending requests.</p>}

        <Table>
          <THead><TR><TH>Account</TH><TH>Role</TH><TH>Linked person</TH><TH>All role views</TH><TH /></TR></THead>
          <TBody>
            {active.map((p) => (
              <TR key={p.uid}>
                <TD><p className="font-medium text-navy">{p.name}</p><p className="text-xs text-muted">{p.email}</p></TD>
                <TD>
                  <Select aria-label={`Role for ${p.name}`} value={p.role} disabled={p.uid === me.uid} onChange={(e) => update(p, { role: e.target.value as Role })} className="h-8 w-36 text-xs">
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                </TD>
                <TD className="text-sm">{db.users.find((u) => u.id === p.userId)?.name ?? '—'}</TD>
                <TD><input type="checkbox" className="size-4 accent-teal" aria-label="All role views" checked={!!p.allRoles} disabled={p.uid === me.uid} onChange={(e) => update(p, { allRoles: e.target.checked })} /></TD>
                <TD className="text-right">{p.uid !== me.uid ? <Button size="sm" variant="ghost" onClick={() => update(p, { role: 'pending', allRoles: false })}><UserX />Revoke</Button> : <span className="text-xs text-muted">You</span>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="text-xs text-muted">Role changes take effect immediately. Security rules in Firestore enforce what each role may change.</p>
      </CardContent>
    </Card>
  );
}
