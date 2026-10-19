// Shared data model for the Halmstad SI concept demo.
// Every dashboard reads from these entities; statistics are always derived, never hardcoded.

export type Role = 'student' | 'leader' | 'coach' | 'supervisor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Students only: programme label */
  programme?: string;
  source?: 'seed' | 'import' | 'account';
}

export interface Course {
  id: string;
  code: string;
  name: string;
  faculty: string;
  credits: number;
  /** Last day of the course (yyyy-MM-dd). After this, students get the SI evaluation and grade reporting. */
  endDate?: string;
}

/** Swedish engineering grading scale used for self-reported final exam results */
export type Grade = 'U' | '3' | '4' | '5';
export const GRADES: Grade[] = ['U', '3', '4', '5'];

export interface GradeReport {
  id: string;
  courseId: string;
  studentId: string;
  grade: Grade;
  consent: boolean;
  reportedAt: string;
}

/** End-of-course evaluation of the SI leader (anonymous to leaders) */
export interface CourseEvaluation {
  id: string;
  courseId: string;
  studentId: string;
  leaderId: string;
  answers: Record<string, string | number>;
  createdAt: string;
}

/** SI leader assigned to a course */
export interface CourseAssignment {
  id: string;
  courseId: string;
  leaderId: string;
}

/** SI coach responsible for an SI leader */
export interface CoachAssignment {
  leaderId: string;
  coachId: string;
}

export interface Enrollment {
  studentId: string;
  courseId: string;
}

export interface SISession {
  id: string;
  courseId: string;
  leaderId: string;
  /** ISO datetime of start */
  start: string;
  durationMin: number;
  location: string;
  topic: string;
  /** Only 'cancelled' is stored. Other statuses are derived from attendance + time. */
  cancelled?: boolean;
  source?: 'seed' | 'leader' | 'import';
  /** QR / code check-in opened by the SI leader */
  checkin?: SessionCheckin;
  plan?: SessionPlan;
  materials?: Material[];
  /** Set when a substitute took over the session */
  originalLeaderId?: string;
}

export interface SessionCheckin {
  code: string;
  openedAt: string;
  closedAt?: string;
  studentIds: string[];
}

export interface PlanActivity {
  id: string;
  title: string;
  minutes: number;
}

export interface SessionPlan {
  templateId?: string;
  goals: string;
  activities: PlanActivity[];
  notes: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  name: string;
  size: number;
  mime: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface SessionFeedback {
  id: string;
  sessionId: string;
  studentId: string;
  rating: number; // 1–5
  helpful: 'yes' | 'partly' | 'no';
  comment: string;
  createdAt: string;
}

export interface SubstituteRequest {
  id: string;
  sessionId: string;
  requesterId: string;
  reason: string;
  status: 'open' | 'accepted' | 'withdrawn';
  substituteId?: string;
  createdAt: string;
  resolvedAt?: string;
}

/** Aggregated totals from earlier semesters (archived, no personal data) */
export interface SemesterArchive {
  semester: string;
  courseId: string;
  sessions: number;
  attendance: number;
  uniqueStudents: number;
  enrolled: number;
  avgRating: number;
}

export type SessionStatus = 'scheduled' | 'completed' | 'attendance_pending' | 'cancelled';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  /** Attendance instances for this session = named students + guests (not unique students across sessions) */
  count: number;
  /** Students registered by name (from the course roster) */
  studentIds?: string[];
  /** Attendees not on the course list (e.g. students from other groups) */
  guests?: number;
  notes: string;
  recordedBy: string;
  recordedAt: string;
  editedAt?: string;
}

export type TopicStatus = 'open' | 'planned' | 'addressed' | 'not_selected';

export interface TopicRequest {
  id: string;
  courseId: string;
  studentId: string;
  text: string;
  createdAt: string;
  voterIds: string[];
  status: TopicStatus;
}

export interface TimeSlot {
  id: string;
  label: string; // e.g. Monday 14:00–16:00
}

export interface TimeSlotPreference {
  studentId: string;
  courseId: string;
  slotIds: string[];
}

export type ObservationStatus = 'not_scheduled' | 'scheduled' | 'draft' | 'completed';

export interface Observation {
  id: string;
  leaderId: string;
  coachId: string;
  courseId: string;
  number: 1 | 2;
  period: string; // e.g. HT2026
  status: ObservationStatus;
  date?: string; // ISO date
  attendees?: number;
  description: string;
  wentWell: string;
  improve: string;
  recommendations: string;
  reflections: string;
  completedAt?: string;
}

export interface EduCategory {
  id: string; // EDU1, EDU2, ...
  name: string;
  description: string;
}

export interface EducationActivity {
  id: string;
  categoryId: string;
  title: string;
  start: string;
  durationMin: number;
  location: string;
  description: string;
  coachId: string;
  participantIds: string[];
  attendedIds: string[];
  status: 'scheduled' | 'completed';
  remindersSent: number;
}

export type QuestionType = 'choice' | 'rating' | 'text';

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[];
}

export interface SurveyResponse {
  id: string;
  respondentId: string;
  submittedAt: string;
  answers: Record<string, string | number>;
}

export interface Survey {
  id: string;
  title: string;
  coachId: string;
  targetGroup: 'my_leaders' | 'all_leaders' | 'students';
  questions: SurveyQuestion[];
  status: 'draft' | 'sent' | 'closed';
  createdAt: string;
  sentAt?: string;
  recipientIds: string[];
  responses: SurveyResponse[];
}

export type WorkCategory =
  | 'SI session'
  | 'Session preparation'
  | 'EDU participation'
  | 'Observation'
  | 'EDU facilitation'
  | 'Survey work'
  | 'Meeting'
  | 'Other';

export interface WorkActivity {
  id: string;
  userId: string;
  date: string; // ISO date
  category: WorkCategory;
  hours: number;
  description: string;
}

export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'returned';

export interface ReportLine {
  category: WorkCategory;
  hours: number;
  detail: string;
}

export interface ReportHistoryEntry {
  at: string;
  byId: string;
  action: 'generated' | 'regenerated' | 'saved' | 'submitted' | 'approved' | 'returned';
  comment?: string;
}

export interface LeaderReportMetrics {
  kind: 'leader';
  courseIds: string[];
  sessionIds: string[];
  sessionsCompleted: number;
  sessionHours: number;
  totalAttendance: number;
  avgAttendance: number;
  cancelledSessions: number;
}

export interface CoachReportMetrics {
  kind: 'coach';
  observationIds: string[];
  eduIds: string[];
  surveyIds: string[];
  activityIds: string[];
  observationsCompleted: number;
  eduActivities: number;
  surveysSent: number;
  leadersSupported: number;
}

export interface MonthlyReport {
  id: string;
  ownerId: string;
  role: 'leader' | 'coach';
  month: string; // yyyy-MM
  status: ReportStatus;
  generatedAt: string;
  submittedAt?: string;
  decidedAt?: string;
  decidedById?: string;
  supervisorComment?: string;
  metrics: LeaderReportMetrics | CoachReportMetrics;
  lines: ReportLine[];
  notes: string;
  reflections: string;
  history: ReportHistoryEntry[];
}

export interface AppNotification {
  id: string;
  recipientIds: string[];
  title: string;
  body: string;
  createdAt: string;
  link?: string;
  kind: 'info' | 'success' | 'warning';
}

export interface ExportColumnConfig {
  key: string;
  label: string;
  include: boolean;
}

export type CalendarProvider = 'outlook' | 'google' | 'apple' | 'ics';

export interface CalendarConnection {
  userId: string;
  provider: CalendarProvider;
  connectedAt: string;
  lastSyncAt: string;
  include: { sessions: boolean; edu: boolean; observations: boolean };
}

export interface Settings {
  /** Demo assumption: compensable prep time per delivered session (hours) */
  prepHoursPerSession: number;
  observationHours: number;
  eduPrepHours: number;
  surveyHours: number;
}

export interface DB {
  version: number;
  seededAt: string;
  users: User[];
  courses: Course[];
  courseAssignments: CourseAssignment[];
  coachAssignments: CoachAssignment[];
  enrollments: Enrollment[];
  sessions: SISession[];
  attendance: AttendanceRecord[];
  topics: TopicRequest[];
  timeSlots: TimeSlot[];
  timePrefs: TimeSlotPreference[];
  observations: Observation[];
  eduCategories: EduCategory[];
  eduActivities: EducationActivity[];
  surveys: Survey[];
  workActivities: WorkActivity[];
  reports: MonthlyReport[];
  notifications: AppNotification[];
  readNotificationIds: string[];
  exportConfigs: Record<string, ExportColumnConfig[]>;
  calendarConnections: CalendarConnection[];
  feedback: SessionFeedback[];
  substituteRequests: SubstituteRequest[];
  semesterArchive: SemesterArchive[];
  grades: GradeReport[];
  evaluations: CourseEvaluation[];
  evaluationTemplate: SurveyQuestion[];
  settings: Settings;
}
