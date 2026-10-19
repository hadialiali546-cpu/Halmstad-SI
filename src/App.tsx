import { useMemo } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CloudStoreProvider, LocalStoreProvider } from '@/data/store';
import { IdentityProvider, useIdentity } from '@/backend/identity';
import { CloudSync } from '@/backend/sync';
import { EmptyDbScreen, FullScreenLoader, LoginScreen, PendingScreen, VerifyEmailScreen } from '@/pages/auth/AuthScreens';
import { useToast } from '@/components/ui/toast';
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui/toast';
import { AppShell } from '@/components/layout/AppShell';
import { Landing } from '@/pages/Landing';
import { DemoGuide } from '@/pages/DemoGuide';
import { NotificationsPage } from '@/pages/shared/NotificationsPage';
import { ResultsPage } from '@/pages/shared/ResultsPage';
import { StudentOverview } from '@/pages/student/StudentOverview';
import { StudentCourses } from '@/pages/student/StudentCourses';
import { StudentSessions } from '@/pages/student/StudentSessions';
import { StudentTopics } from '@/pages/student/StudentTopics';
import { StudentTimes } from '@/pages/student/StudentTimes';
import { StudentCheckin } from '@/pages/student/StudentCheckin';
import { LeaderOverview } from '@/pages/leader/LeaderOverview';
import { LeaderSessions } from '@/pages/leader/LeaderSessions';
import { LeaderAttendance } from '@/pages/leader/LeaderAttendance';
import { LeaderRequests } from '@/pages/leader/LeaderRequests';
import { LeaderReports } from '@/pages/leader/LeaderReports';
import { CoachOverview } from '@/pages/coach/CoachOverview';
import { CoachLeaders } from '@/pages/coach/CoachLeaders';
import { CoachObservations } from '@/pages/coach/CoachObservations';
import { CoachEdu } from '@/pages/coach/CoachEdu';
import { CoachSurveys } from '@/pages/coach/CoachSurveys';
import { CoachReports } from '@/pages/coach/CoachReports';
import { SupOverview } from '@/pages/supervisor/SupOverview';
import { SupCourses, SupCourseDetail } from '@/pages/supervisor/SupCourses';
import { SupAnalytics } from '@/pages/supervisor/SupAnalytics';
import { SupTeam } from '@/pages/supervisor/SupTeam';
import { SupReports } from '@/pages/supervisor/SupReports';
import { SupImportExport } from '@/pages/supervisor/SupImportExport';
import { SupPayroll } from '@/pages/supervisor/SupPayroll';
import { SupFeedback } from '@/pages/supervisor/SupFeedback';

// HashRouter keeps the app working from any static host or file server without rewrites.
export function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <IdentityProvider>
          <HashRouter>
            <Root />
          </HashRouter>
        </IdentityProvider>
      </ToastProvider>
    </I18nProvider>
  );
}

function Root() {
  const id = useIdentity();
  const toast = useToast();
  const sync = useMemo(() => (id.backend?.mode === 'cloud' ? new CloudSync(id.backend.fs) : null), [id.backend]);
  if (!id.backend || !id.ready) return <FullScreenLoader />;
  if (id.backend.mode === 'local') return <LocalStoreProvider><AppRoutes /></LocalStoreProvider>;
  if (!id.user) return <LoginScreen />;
  if (id.bootstrapNeedsVerification) return <VerifyEmailScreen />;
  if (!id.profile || id.profile.role === 'pending') return <PendingScreen />;
  return (
    <CloudStoreProvider
      key={id.user.uid}
      sync={sync!}
      uid={id.user.uid}
      onError={(e) => {
        const denied = /permission/i.test(String((e as { code?: string }).code ?? e.message));
        toast({ title: denied ? 'Not allowed' : 'Sync problem', body: denied ? 'Your role does not allow this change, so it was not saved.' : 'Could not reach the database. Changes will retry when you are online.', tone: 'warning' });
      }}
      renderLoading={() => <FullScreenLoader text="Loading live data…" />}
      renderEmpty={(seed) => <EmptyDbScreen seed={seed} isSupervisor={id.profile!.role === 'supervisor'} />}
    >
      <AppRoutes />
    </CloudStoreProvider>
  );
}

function HomeRoute() {
  const { canSwitchRoles, profile } = useIdentity();
  if (!canSwitchRoles && profile && profile.role !== 'pending') return <Navigate to={`/${profile.role}`} replace />;
  return <Landing />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
              <Route element={<AppShell />}>
                <Route path="/guide" element={<DemoGuide />} />
                <Route path="/student" element={<StudentOverview />} />
                <Route path="/student/courses" element={<StudentCourses />} />
                <Route path="/student/sessions" element={<StudentSessions />} />
                <Route path="/student/topics" element={<StudentTopics />} />
                <Route path="/student/times" element={<StudentTimes />} />
                <Route path="/student/checkin/:sessionId" element={<StudentCheckin />} />
                <Route path="/leader" element={<LeaderOverview />} />
                <Route path="/leader/sessions" element={<LeaderSessions />} />
                <Route path="/leader/attendance" element={<LeaderAttendance />} />
                <Route path="/leader/requests" element={<LeaderRequests />} />
                <Route path="/leader/reports" element={<LeaderReports />} />
                <Route path="/coach" element={<CoachOverview />} />
                <Route path="/coach/leaders" element={<CoachLeaders />} />
                <Route path="/coach/observations" element={<CoachObservations />} />
                <Route path="/coach/edu" element={<CoachEdu />} />
                <Route path="/coach/surveys" element={<CoachSurveys />} />
                <Route path="/coach/reports" element={<CoachReports />} />
                <Route path="/supervisor" element={<SupOverview />} />
                <Route path="/supervisor/courses" element={<SupCourses />} />
                <Route path="/supervisor/courses/:courseId" element={<SupCourseDetail />} />
                <Route path="/supervisor/analytics" element={<SupAnalytics />} />
                <Route path="/supervisor/team" element={<SupTeam />} />
                <Route path="/supervisor/reports" element={<SupReports />} />
                <Route path="/supervisor/import-export" element={<SupImportExport />} />
                <Route path="/supervisor/payroll" element={<SupPayroll />} />
                <Route path="/supervisor/feedback" element={<SupFeedback />} />
                <Route path="/:role/notifications" element={<NotificationsPage />} />
                <Route path="/:role/results" element={<ResultsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
