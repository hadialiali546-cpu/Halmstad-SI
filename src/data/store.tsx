// Shared application state. A single DB object persisted to localStorage.
// All actions live here so a future backend can replace them with API calls one by one.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addWeeks, format, parseISO } from 'date-fns';
import { buildReport, courseName, findReport, monthLabel, studentsOfCourse, userName, usersByRole, leadersOfCoach } from './calc';
import { createSeed, DB_VERSION } from './seed';
import type { CloudSync } from '@/backend/sync';
import type {
  AppNotification, CalendarConnection, CalendarProvider, DB, Grade, SurveyQuestion, Material, SessionFeedback, SessionPlan, EducationActivity, ExportColumnConfig, MonthlyReport, Observation, SISession, Survey, TopicStatus, User, WorkActivity,
} from './types';

const STORAGE_KEY = 'halmstad-si-demo-db';

export const PROVIDER_LABEL: Record<CalendarProvider, string> = {
  outlook: 'Outlook / Microsoft 365',
  google: 'Google Calendar',
  apple: 'Apple Calendar (iCloud)',
  ics: 'Calendar subscription (ICS)',
};

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION) return db;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return createSeed();
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => new Date().toISOString();

export interface ImportRow {
  name: string;
  role: string;
  courseCode: string;
  courseName: string;
  sessionDate: string; // yyyy-MM-dd HH:mm
  durationMin: number;
  attendance: number;
}

function notify(db: DB, n: Omit<AppNotification, 'id' | 'createdAt'> & { id?: string }) {
  db.notifications.unshift({ id: n.id ?? uid('evt'), createdAt: nowIso(), ...n });
}

function makeActions(mutate: (fn: (db: DB) => void) => void, resetImpl: () => Promise<void> | void) {
  return {
    /** Restore the fictional demo dataset (local: this browser; cloud: whole database, supervisor only) */
    reset() {
      return resetImpl();
    },

    // ---------- sessions & attendance ----------
    recordAttendance(sessionId: string, studentIds: string[], guests: number, notes: string, byId: string) {
      mutate((db) => {
        const existing = db.attendance.find((a) => a.sessionId === sessionId);
        const count = studentIds.length + guests;
        if (existing) {
          Object.assign(existing, { count, studentIds, guests, notes, editedAt: nowIso() });
        } else {
          db.attendance.push({ id: uid('att'), sessionId, count, studentIds, guests, notes, recordedBy: byId, recordedAt: nowIso() });
        }
        // Keep an existing (non-final) report draft in sync automatically
        const s = db.sessions.find((x) => x.id === sessionId);
        if (s) {
          const month = format(parseISO(s.start), 'yyyy-MM');
          const rep = findReport(db, s.leaderId, month);
          if (rep && (rep.status === 'draft' || rep.status === 'returned')) {
            const fresh = buildReport(db, s.leaderId, month);
            rep.metrics = fresh.metrics;
            rep.lines = fresh.lines;
            rep.history.push({ at: nowIso(), byId, action: 'regenerated', comment: 'Auto-updated after attendance change' });
          }
        }
      });
    },
    /** Schedule a session; repeatWeeks > 1 creates a weekly series */
    addSession(s: Omit<SISession, 'id'>, repeatWeeks = 1) {
      mutate((db) => {
        const n = Math.max(1, Math.min(20, repeatWeeks));
        for (let i = 0; i < n; i++) {
          db.sessions.push({ ...s, id: uid('ses'), start: addWeeks(parseISO(s.start), i).toISOString() });
        }
        db.sessions.sort((a, b) => a.start.localeCompare(b.start));
        notify(db, {
          recipientIds: studentsOfCourse(db, s.courseId),
          title: n > 1 ? 'New weekly SI sessions' : 'New SI session added',
          body: n > 1
            ? `${n} weekly SI sessions added for ${courseName(db, s.courseId)}, starting ${format(parseISO(s.start), 'EEEE d MMM, HH:mm')}.`
            : `New SI session added for ${courseName(db, s.courseId)} on ${format(parseISO(s.start), 'EEEE d MMM, HH:mm')}.`,
          link: '/student/sessions',
          kind: 'info',
        });
      });
    },

    // ---------- QR check-in ----------
    openCheckin(sessionId: string) {
      mutate((db) => {
        const s = db.sessions.find((x) => x.id === sessionId);
        if (!s) return;
        if (s.checkin && !s.checkin.closedAt) return;
        const code = String(1000 + Math.floor(Math.random() * 9000));
        // students get a live (derived) "check-in is open" reminder that disappears when check-in closes
        s.checkin = { code, openedAt: nowIso(), studentIds: s.checkin?.studentIds ?? [] };
      });
    },
    closeCheckin(sessionId: string) {
      mutate((db) => {
        const s = db.sessions.find((x) => x.id === sessionId);
        if (s?.checkin && !s.checkin.closedAt) s.checkin.closedAt = nowIso();
      });
    },
    /** Returns an error message, or null on success (validated against current state) */
    checkIn(db: DB, sessionId: string, studentId: string, code: string): string | null {
      const s = db.sessions.find((x) => x.id === sessionId);
      if (!s?.checkin || s.checkin.closedAt) return 'Check-in is not open for this session.';
      if (!studentsOfCourse(db, s.courseId).includes(studentId)) return 'You are not registered on this course.';
      if (s.checkin.studentIds.includes(studentId)) return 'You are already checked in.';
      if (code.trim() !== s.checkin.code) return 'Wrong code — check the code shown by your SI leader.';
      mutate((d) => {
        const x = d.sessions.find((y) => y.id === sessionId);
        if (x?.checkin && !x.checkin.studentIds.includes(studentId)) x.checkin.studentIds.push(studentId);
      });
      return null;
    },
    simulateCheckins(sessionId: string, n: number) {
      mutate((db) => {
        const s = db.sessions.find((x) => x.id === sessionId);
        if (!s?.checkin || s.checkin.closedAt) return;
        const pool = studentsOfCourse(db, s.courseId).filter((id) => !s.checkin!.studentIds.includes(id) && id !== 'stu-emma');
        pool.sort(() => Math.random() - 0.5).slice(0, n).forEach((id) => s.checkin!.studentIds.push(id));
      });
    },

    // ---------- end of course: grades & SI evaluation ----------
    reportGrade(courseId: string, studentId: string, grade: Grade, consent: boolean) {
      mutate((db) => {
        const ex = db.grades.find((g) => g.courseId === courseId && g.studentId === studentId);
        if (ex) Object.assign(ex, { grade, consent, reportedAt: nowIso() });
        else db.grades.push({ id: uid('gr'), courseId, studentId, grade, consent, reportedAt: nowIso() });
      });
    },
    submitEvaluation(courseId: string, studentId: string, leaderId: string, answers: Record<string, string | number>) {
      mutate((db) => {
        if (db.evaluations.some((e) => e.courseId === courseId && e.studentId === studentId)) return;
        db.evaluations.push({ id: uid('ev'), courseId, studentId, leaderId, answers, createdAt: nowIso() });
      });
    },
    saveEvaluationTemplate(questions: SurveyQuestion[]) {
      mutate((db) => { db.evaluationTemplate = questions; });
    },
    /** Set a course's end date. Ending a course cancels any later sessions (no notifications). */
    setCourseEndDate(courseId: string, endDate: string) {
      mutate((db) => {
        const c = db.courses.find((x) => x.id === courseId);
        if (!c) return;
        c.endDate = endDate;
        const end = parseISO(endDate + 'T23:59');
        db.sessions.forEach((s) => { if (s.courseId === courseId && parseISO(s.start) > end && !db.attendance.some((a) => a.sessionId === s.id)) s.cancelled = true; });
        if (end < new Date())
          notify(db, {
            recipientIds: studentsOfCourse(db, courseId),
            title: `${c.name} has finished`,
            body: 'Please evaluate your SI leader and report your final exam result when you have it.',
            link: '/student/results',
            kind: 'info',
          });
      });
    },

    // ---------- feedback ----------
    submitFeedback(f: Omit<SessionFeedback, 'id' | 'createdAt'>) {
      mutate((db) => {
        if (db.feedback.some((x) => x.sessionId === f.sessionId && x.studentId === f.studentId)) return;
        db.feedback.push({ ...f, id: uid('fb'), createdAt: nowIso() });
      });
    },

    // ---------- planning ----------
    saveSessionPlan(sessionId: string, plan: SessionPlan | undefined, materials: Material[]) {
      mutate((db) => {
        const s = db.sessions.find((x) => x.id === sessionId);
        if (!s) return;
        s.plan = plan ? { ...plan, updatedAt: nowIso() } : undefined;
        const added = materials.filter((m) => !(s.materials ?? []).some((o) => o.id === m.id));
        s.materials = materials;
        if (added.length)
          notify(db, {
            recipientIds: studentsOfCourse(db, s.courseId),
            title: 'New SI material',
            body: `${added.map((m) => m.name).join(', ')} added to the ${courseName(db, s.courseId)} session on ${format(parseISO(s.start), 'EEE d MMM')}.`,
            link: '/student/sessions',
            kind: 'info',
          });
      });
    },
    requestSubstitute(sessionId: string, requesterId: string, reason: string) {
      mutate((db) => {
        const s = db.sessions.find((x) => x.id === sessionId);
        if (!s || db.substituteRequests.some((r) => r.sessionId === sessionId && r.status === 'open')) return;
        db.substituteRequests.push({ id: uid('sub'), sessionId, requesterId, reason, status: 'open', createdAt: nowIso() });
        notify(db, {
          recipientIds: [...db.courseAssignments.filter((a) => a.courseId === s.courseId && a.leaderId !== requesterId).map((a) => a.leaderId), ...usersByRole(db, 'supervisor').map((u) => u.id)],
          title: 'Substitute needed',
          body: `${userName(db, requesterId)} needs a substitute for ${courseName(db, s.courseId)} on ${format(parseISO(s.start), 'EEE d MMM, HH:mm')}.`,
          link: '/leader',
          kind: 'warning',
        });
      });
    },
    resolveSubstitute(requestId: string, action: 'accept' | 'withdraw', userId: string) {
      mutate((db) => {
        const r = db.substituteRequests.find((x) => x.id === requestId);
        if (!r || r.status !== 'open') return;
        r.resolvedAt = nowIso();
        if (action === 'withdraw') { r.status = 'withdrawn'; return; }
        const s = db.sessions.find((x) => x.id === r.sessionId);
        if (!s) return;
        r.status = 'accepted';
        r.substituteId = userId;
        s.originalLeaderId = s.leaderId;
        s.leaderId = userId;
        notify(db, { recipientIds: [r.requesterId], title: 'Substitute found', body: `${userName(db, userId)} will lead your session on ${format(parseISO(s.start), 'EEE d MMM')}.`, link: '/leader/sessions', kind: 'success' });
        notify(db, { recipientIds: studentsOfCourse(db, s.courseId), title: 'SI leader change', body: `${userName(db, userId)} will lead the ${courseName(db, s.courseId)} session on ${format(parseISO(s.start), 'EEE d MMM, HH:mm')}.`, link: '/student/sessions', kind: 'info' });
      });
    },
    setSessionCancelled(id: string, cancelled: boolean) {
      mutate((db) => {
        const s = db.sessions.find((x) => x.id === id);
        if (!s) return;
        s.cancelled = cancelled;
        if (cancelled)
          notify(db, {
            recipientIds: studentsOfCourse(db, s.courseId),
            title: 'SI session cancelled',
            body: `The ${courseName(db, s.courseId)} SI session on ${format(parseISO(s.start), 'EEE d MMM, HH:mm')} has been cancelled.`,
            link: '/student/sessions',
            kind: 'warning',
          });
      });
    },

    // ---------- topics & preferences ----------
    addTopic(courseId: string, studentId: string, text: string) {
      mutate((db) => {
        db.topics.unshift({ id: uid('top'), courseId, studentId, text, createdAt: nowIso(), voterIds: [studentId], status: 'open' });
      });
    },
    toggleVote(topicId: string, studentId: string) {
      mutate((db) => {
        const t = db.topics.find((x) => x.id === topicId);
        if (!t) return;
        t.voterIds = t.voterIds.includes(studentId) ? t.voterIds.filter((v) => v !== studentId) : [...t.voterIds, studentId];
      });
    },
    setTopicStatus(topicId: string, status: TopicStatus) {
      mutate((db) => {
        const t = db.topics.find((x) => x.id === topicId);
        if (!t) return;
        t.status = status;
        const label = { planned: 'planned for an upcoming session', addressed: 'addressed in a session', not_selected: 'not selected this time', open: 'reopened' }[status];
        notify(db, {
          recipientIds: Array.from(new Set([t.studentId, ...t.voterIds])),
          title: status === 'planned' ? 'Topic planned' : 'Topic update',
          body: `“${t.text}” (${courseName(db, t.courseId)}) was ${label}.`,
          link: '/student/topics',
          kind: status === 'not_selected' ? 'info' : 'success',
        });
      });
    },
    setTimePrefs(studentId: string, courseId: string, slotIds: string[]) {
      mutate((db) => {
        db.timePrefs = db.timePrefs.filter((p) => !(p.studentId === studentId && p.courseId === courseId));
        if (slotIds.length) db.timePrefs.push({ studentId, courseId, slotIds });
      });
    },

    // ---------- notifications ----------
    markRead(ids: string[]) {
      mutate((db) => {
        db.readNotificationIds = Array.from(new Set([...db.readNotificationIds, ...ids]));
      });
    },
    markUnread(id: string) {
      mutate((db) => {
        db.readNotificationIds = db.readNotificationIds.filter((x) => x !== id);
      });
    },

    // ---------- observations ----------
    scheduleObservation(id: string, date: string) {
      mutate((db) => {
        const o = db.observations.find((x) => x.id === id);
        if (o && o.status !== 'completed') {
          o.date = date;
          if (o.status === 'not_scheduled') o.status = 'scheduled';
          notify(db, {
            recipientIds: [o.leaderId],
            title: 'Observation scheduled',
            body: `Observation ${o.number} with ${userName(db, o.coachId)} is scheduled for ${format(parseISO(date), 'EEEE d MMM')}.`,
            link: '/leader',
            kind: 'info',
          });
        }
      });
    },
    saveObservation(obs: Observation, complete: boolean) {
      mutate((db) => {
        const i = db.observations.findIndex((x) => x.id === obs.id);
        const next: Observation = { ...obs, status: complete ? 'completed' : obs.status === 'completed' ? 'completed' : 'draft' };
        if (complete) next.completedAt = nowIso();
        if (i >= 0) db.observations[i] = next;
        if (complete) {
          notify(db, {
            recipientIds: [obs.leaderId],
            title: 'Observation feedback available',
            body: `${userName(db, obs.coachId)} completed Observation ${obs.number}. Feedback is now in your coaching record.`,
            link: '/leader',
            kind: 'success',
          });
          const month = obs.date ? obs.date.slice(0, 7) : format(new Date(), 'yyyy-MM');
          refreshDraft(db, obs.coachId, month);
        }
      });
    },

    // ---------- EDU ----------
    saveEdu(a: EducationActivity) {
      mutate((db) => {
        const i = db.eduActivities.findIndex((x) => x.id === a.id);
        if (i >= 0) db.eduActivities[i] = a;
        else {
          db.eduActivities.push(a);
          notify(db, {
            recipientIds: a.participantIds,
            title: `${a.categoryId} scheduled`,
            body: `${a.title} — ${format(parseISO(a.start), 'EEEE d MMM, HH:mm')} at ${a.location}.`,
            link: '/leader/notifications',
            kind: 'info',
          });
        }
        if (a.status === 'completed') refreshDraft(db, a.coachId, a.start.slice(0, 7));
      });
    },
    sendEduReminder(id: string) {
      mutate((db) => {
        const a = db.eduActivities.find((x) => x.id === id);
        if (!a) return;
        a.remindersSent += 1;
        notify(db, {
          recipientIds: a.participantIds,
          title: `Reminder: ${a.categoryId}`,
          body: `${a.categoryId} takes place on ${format(parseISO(a.start), 'EEEE d MMM')} at ${format(parseISO(a.start), 'HH:mm')} — ${a.location}.`,
          link: '/leader/notifications',
          kind: 'info',
        });
      });
    },
    addEduCategory(name: string, description: string) {
      mutate((db) => {
        const id = name.trim().toUpperCase().replace(/\s+/g, '-');
        if (!db.eduCategories.some((c) => c.id === id)) db.eduCategories.push({ id, name: name.trim(), description });
      });
    },

    // ---------- surveys ----------
    saveSurvey(s: Survey) {
      mutate((db) => {
        const i = db.surveys.findIndex((x) => x.id === s.id);
        if (i >= 0) db.surveys[i] = s;
        else db.surveys.unshift(s);
      });
    },
    sendSurvey(id: string) {
      mutate((db) => {
        const s = db.surveys.find((x) => x.id === id);
        if (!s) return;
        s.recipientIds =
          s.targetGroup === 'my_leaders' ? leadersOfCoach(db, s.coachId)
            : s.targetGroup === 'all_leaders' ? usersByRole(db, 'leader').map((u) => u.id)
              : usersByRole(db, 'student').map((u) => u.id);
        s.status = 'sent';
        s.sentAt = nowIso();
        notify(db, {
          recipientIds: s.recipientIds,
          title: 'New survey (simulated invitation)',
          body: `${userName(db, s.coachId)} invited you to answer “${s.title}”.`,
          kind: 'info',
        });
        refreshDraft(db, s.coachId, s.sentAt.slice(0, 7));
      });
    },
    simulateResponses(id: string) {
      mutate((db) => {
        const s = db.surveys.find((x) => x.id === id);
        if (!s) return;
        const answered = new Set(s.responses.map((r) => r.respondentId));
        const pending = s.recipientIds.filter((r) => !answered.has(r));
        const texts = ['More time to plan would help.', 'Going well overall.', 'Would like examples of good opening activities.', 'Attendance dips before deadlines.'];
        pending.slice(0, Math.max(1, Math.ceil(pending.length * 0.6))).forEach((rid, i) => {
          const answers: Record<string, string | number> = {};
          s.questions.forEach((q) => {
            if (q.type === 'rating') answers[q.id] = 3 + ((i + q.id.length) % 3);
            else if (q.type === 'choice') answers[q.id] = q.options?.[(i * 3 + q.text.length) % (q.options.length || 1)] ?? '';
            else answers[q.id] = texts[i % texts.length];
          });
          s.responses.push({ id: uid('resp'), respondentId: rid, submittedAt: nowIso(), answers });
        });
      });
    },
    closeSurvey(id: string) {
      mutate((db) => {
        const s = db.surveys.find((x) => x.id === id);
        if (s) s.status = 'closed';
      });
    },

    // ---------- work activities ----------
    addWorkActivity(w: Omit<WorkActivity, 'id'>) {
      mutate((db) => {
        db.workActivities.push({ ...w, id: uid('wa') });
        refreshDraft(db, w.userId, w.date.slice(0, 7));
      });
    },
    removeWorkActivity(id: string) {
      mutate((db) => {
        const w = db.workActivities.find((x) => x.id === id);
        db.workActivities = db.workActivities.filter((x) => x.id !== id);
        if (w) refreshDraft(db, w.userId, w.date.slice(0, 7));
      });
    },

    // ---------- reports ----------
    generateReport(ownerId: string, month: string) {
      mutate((db) => {
        const existing = findReport(db, ownerId, month);
        const fresh = buildReport(db, ownerId, month);
        if (!existing) db.reports.push(fresh);
        else if (existing.status === 'draft' || existing.status === 'returned') {
          existing.metrics = fresh.metrics;
          existing.lines = fresh.lines;
          existing.generatedAt = fresh.generatedAt;
          existing.history.push({ at: nowIso(), byId: ownerId, action: 'regenerated' });
        }
      });
    },
    saveReportText(id: string, notes: string, reflections: string) {
      mutate((db) => {
        const r = db.reports.find((x) => x.id === id);
        if (!r || r.status === 'submitted' || r.status === 'approved') return;
        r.notes = notes;
        r.reflections = reflections;
        r.history.push({ at: nowIso(), byId: r.ownerId, action: 'saved' });
      });
    },
    submitReport(id: string) {
      mutate((db) => {
        const r = db.reports.find((x) => x.id === id);
        if (!r || r.status === 'submitted' || r.status === 'approved') return;
        r.status = 'submitted';
        r.submittedAt = nowIso();
        r.history.push({ at: r.submittedAt, byId: r.ownerId, action: 'submitted' });
        notify(db, {
          recipientIds: usersByRole(db, 'supervisor').map((u) => u.id),
          title: 'Report submitted',
          body: `${userName(db, r.ownerId)} submitted the ${monthLabel(r.month)} ${r.role === 'leader' ? 'SI leader' : 'SI coach'} report.`,
          link: '/supervisor/reports',
          kind: 'info',
        });
      });
    },
    decideReport(id: string, supervisorId: string, decision: 'approved' | 'returned', comment?: string) {
      mutate((db) => {
        const r = db.reports.find((x) => x.id === id);
        if (!r || r.status !== 'submitted') return;
        r.status = decision;
        r.decidedAt = nowIso();
        r.decidedById = supervisorId;
        r.supervisorComment = comment;
        r.history.push({ at: r.decidedAt, byId: supervisorId, action: decision, comment });
        notify(db, {
          recipientIds: [r.ownerId],
          title: decision === 'approved' ? 'Report approved' : 'Report returned for correction',
          body: decision === 'approved'
            ? `Your ${monthLabel(r.month)} monthly report was approved by ${userName(db, supervisorId)}.`
            : `Your ${monthLabel(r.month)} report needs correction: ${comment}`,
          link: r.role === 'leader' ? '/leader/reports' : '/coach/reports',
          kind: decision === 'approved' ? 'success' : 'warning',
        });
      });
    },

    // ---------- people (cloud: approving new accounts) ----------
    addPerson(u: Pick<User, 'id' | 'name' | 'email' | 'role'>, courseIds: string[]) {
      mutate((db) => {
        if (!db.users.some((x) => x.id === u.id)) db.users.push({ ...u, source: 'account' });
        courseIds.forEach((courseId) => {
          if (u.role === 'student' && !db.enrollments.some((e) => e.studentId === u.id && e.courseId === courseId)) db.enrollments.push({ studentId: u.id, courseId });
          if (u.role === 'leader' && !db.courseAssignments.some((a) => a.leaderId === u.id && a.courseId === courseId)) db.courseAssignments.push({ id: uid('ca'), courseId, leaderId: u.id });
        });
      });
    },

    // ---------- team ----------
    assignLeaderToCourse(courseId: string, leaderId: string) {
      mutate((db) => {
        if (!db.courseAssignments.some((a) => a.courseId === courseId && a.leaderId === leaderId))
          db.courseAssignments.push({ id: uid('ca'), courseId, leaderId });
        notify(db, { recipientIds: [leaderId], title: 'New course assignment', body: `You are now assigned as SI leader for ${courseName(db, courseId)}.`, kind: 'info' });
      });
    },
    removeCourseAssignment(id: string) {
      mutate((db) => {
        db.courseAssignments = db.courseAssignments.filter((a) => a.id !== id);
      });
    },
    setCoach(leaderId: string, coachId: string) {
      mutate((db) => {
        db.coachAssignments = db.coachAssignments.filter((a) => a.leaderId !== leaderId);
        if (coachId) db.coachAssignments.push({ leaderId, coachId });
        // pending (not completed) observations follow the new coach
        db.observations.forEach((o) => {
          if (o.leaderId === leaderId && o.status !== 'completed' && coachId) o.coachId = coachId;
        });
      });
    },

    // ---------- import ----------
    importRows(rows: ImportRow[]) {
      mutate((db) => {
        rows.forEach((row) => {
          const course = db.courses.find((c) => c.code.toLowerCase() === row.courseCode.toLowerCase())!;
          let user = db.users.find((u) => u.name.toLowerCase() === row.name.toLowerCase());
          if (!user) {
            const u: User = {
              id: uid('ldr'), name: row.name, role: 'leader', source: 'import',
              email: row.name.toLowerCase().replace(/\s+/g, '.') + '@demo.hh-si.example',
            };
            db.users.push(u);
            user = u;
          }
          if (!db.courseAssignments.some((a) => a.courseId === course.id && a.leaderId === user!.id))
            db.courseAssignments.push({ id: uid('ca'), courseId: course.id, leaderId: user.id });
          const start = parseISO(row.sessionDate.replace(' ', 'T'));
          const session: SISession = {
            id: uid('ses'), courseId: course.id, leaderId: user.id, start: start.toISOString(), durationMin: row.durationMin,
            location: 'Imported record', topic: 'Imported from spreadsheet', source: 'import',
          };
          db.sessions.push(session);
          db.attendance.push({ id: uid('att'), sessionId: session.id, count: row.attendance, studentIds: [], guests: 0, notes: 'Imported (count only — no names in file)', recordedBy: 'import', recordedAt: nowIso() });
        });
        db.sessions.sort((a, b) => a.start.localeCompare(b.start));
      });
      return rows.length;
    },

    // ---------- calendar (simulated connection) ----------
    connectCalendar(userId: string, provider: CalendarProvider, upcoming: number) {
      mutate((db) => {
        db.calendarConnections = db.calendarConnections.filter((c) => c.userId !== userId);
        db.calendarConnections.push({ userId, provider, connectedAt: nowIso(), lastSyncAt: nowIso(), include: { sessions: true, edu: true, observations: true } });
        notify(db, {
          recipientIds: [userId],
          title: 'Calendar connected',
          body: `${PROVIDER_LABEL[provider]} connected (simulated). ${upcoming} upcoming event(s) will stay in sync automatically.`,
          kind: 'success',
        });
      });
    },
    updateCalendar(userId: string, include: CalendarConnection['include']) {
      mutate((db) => {
        const c = db.calendarConnections.find((x) => x.userId === userId);
        if (c) { c.include = include; c.lastSyncAt = nowIso(); }
      });
    },
    syncCalendar(userId: string) {
      mutate((db) => {
        const c = db.calendarConnections.find((x) => x.userId === userId);
        if (c) c.lastSyncAt = nowIso();
      });
    },
    disconnectCalendar(userId: string) {
      mutate((db) => {
        db.calendarConnections = db.calendarConnections.filter((c) => c.userId !== userId);
      });
    },

    setExportConfig(key: string, cols: ExportColumnConfig[]) {
      mutate((db) => {
        db.exportConfigs[key] = cols;
      });
    },
  };
}

/** If a draft/returned report exists for the owner+month, refresh its numbers. */
function refreshDraft(db: DB, ownerId: string, month: string) {
  const rep = findReport(db, ownerId, month);
  if (rep && (rep.status === 'draft' || rep.status === 'returned')) {
    const fresh = buildReport(db, ownerId, month);
    rep.metrics = fresh.metrics;
    rep.lines = fresh.lines;
  }
}

export type Actions = ReturnType<typeof makeActions>;

interface StoreValue {
  db: DB;
  actions: Actions;
  mode: 'local' | 'cloud';
  /** current time — ticks every minute so derived statuses stay fresh */
  now: Date;
}

const StoreCtx = createContext<StoreValue | null>(null);

/** Shared mutate logic: clone → apply → publish → persist (no side effects inside React updaters) */
function useMutableDb(initial: () => DB, onCommit: (prev: DB, next: DB) => void) {
  const [db, setDbState] = useState<DB>(initial);
  const dbRef = useRef(db);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const setDb = useCallback((next: DB) => { dbRef.current = next; setDbState(next); }, []);
  const mutate = useCallback((fn: (db: DB) => void) => {
    const prev = dbRef.current;
    const next = structuredClone(prev);
    fn(next);
    dbRef.current = next;
    setDbState(next);
    commitRef.current(prev, next);
  }, []);
  return { db, setDb, mutate, dbRef };
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Local mode: everything in this browser's storage */
export function LocalStoreProvider({ children }: { children: ReactNode }) {
  const now = useNow();
  const { db, setDb, mutate } = useMutableDb(load, () => undefined);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* storage unavailable */ }
  }, [db]);
  const actions = useMemo(() => makeActions(mutate, () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setDb(createSeed());
  }), [mutate, setDb]);
  const value = useMemo(() => ({ db, actions, now, mode: 'local' as const }), [db, actions, now]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/** Cloud mode: shared, real-time data in Firestore */
export function CloudStoreProvider({ sync, uid, children, onError, renderEmpty, renderLoading }: {
  sync: CloudSync; uid: string; children: ReactNode; onError: (e: Error) => void;
  renderEmpty: (seed: () => Promise<void>) => ReactNode; renderLoading: () => ReactNode;
}) {
  const now = useNow();
  const readKey = `halmstad-si-read-${uid}`;
  const readIds = (): string[] => { try { return JSON.parse(localStorage.getItem(readKey) ?? '[]'); } catch { return []; } };
  const [status, setStatus] = useState<'loading' | 'empty' | 'ready'>('loading');
  const errRef = useRef(onError);
  errRef.current = onError;
  const { db, setDb, mutate } = useMutableDb(createSeed, (prev, next) => {
    if (prev.readNotificationIds !== next.readNotificationIds) {
      try { localStorage.setItem(readKey, JSON.stringify(next.readNotificationIds)); } catch { /* ignore */ }
    }
    sync.write(prev, next).catch((e) => errRef.current(e));
  });
  useEffect(() => sync.subscribe((data) => {
    if (!data) { setStatus('empty'); return; }
    setDb({ ...data, readNotificationIds: readIds() } as DB);
    setStatus('ready');
  }, (e) => errRef.current(e)), [sync]); // eslint-disable-line react-hooks/exhaustive-deps
  const seed = useCallback(async () => { await sync.replaceAll(createSeed()); }, [sync]);
  const actions = useMemo(() => makeActions(mutate, seed), [mutate, seed]);
  const value = useMemo(() => ({ db, actions, now, mode: 'cloud' as const }), [db, actions, now]);
  if (status === 'loading') return <>{renderLoading()}</>;
  if (status === 'empty') return <>{renderEmpty(seed)}</>;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}

export type { MonthlyReport };
