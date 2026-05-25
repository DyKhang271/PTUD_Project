import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import { AdminLayout, StudentLayout, TeacherLayout } from "./layouts/RoleLayouts";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentTimetable from "./pages/student/StudentTimetable";
import StudentExams from "./pages/student/StudentExams";
import StudentAttendanceHistory from "./pages/student/StudentAttendanceHistory";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherSections from "./pages/teacher/TeacherSections";
import AttendanceSessionPage from "./pages/teacher/AttendanceSessionPage";
import AttendanceReportPage from "./pages/teacher/AttendanceReportPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AcademicDataPage from "./pages/admin/AcademicDataPage";
import TermManagement from "./pages/admin/TermManagement";
import CourseSectionManagement from "./pages/admin/CourseSectionManagement";
import TimetableManagement from "./pages/admin/TimetableManagement";
import AttendancePolicyPage from "./pages/admin/AttendancePolicyPage";
import CourseOpeningPlanPage from "./pages/admin/course-opening-plan/CourseOpeningPlanPage";

function AuthRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role)) {
    if (user?.role === "student") {
      return <Navigate to="/student/dashboard" replace />;
    }
    if (user?.role === "teacher") {
      return <Navigate to="/teacher/dashboard" replace />;
    }
    if (user?.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/${user.role}/dashboard`} replace />;
}

export const router = createBrowserRouter([
  {
    element: <AuthRoot />,
    children: [
      { path: "/", element: <HomeRedirect /> },
      { path: "/login", element: <LoginPage /> },
      {
        element: <ProtectedRoute allowedRoles={["student"]} />,
        children: [
          {
            element: <StudentLayout />,
            children: [
              { path: "/student/dashboard", element: <StudentDashboard /> },
              { path: "/student/timetable", element: <StudentTimetable /> },
              { path: "/student/exams", element: <StudentExams /> },
              { path: "/student/attendance", element: <StudentAttendanceHistory /> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={["teacher"]} />,
        children: [
          {
            element: <TeacherLayout />,
            children: [
              { path: "/teacher/dashboard", element: <TeacherDashboard /> },
              { path: "/teacher/sections", element: <TeacherSections /> },
              { path: "/teacher/sections/:sectionId/attendance", element: <AttendanceSessionPage /> },
              { path: "/teacher/sections/:sectionId/report", element: <AttendanceReportPage /> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={["admin"]} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: "/admin/dashboard", element: <AdminDashboard /> },
              { path: "/admin/academic-data", element: <AcademicDataPage /> },
              { path: "/admin/terms", element: <TermManagement /> },
              { path: "/admin/sections", element: <CourseSectionManagement /> },
              { path: "/admin/scheduling", element: <TimetableManagement /> },
              { path: "/admin/attendance", element: <AttendancePolicyPage /> },
              { path: "/admin/academic-data/advanced/plan", element: <CourseOpeningPlanPage /> },
              { path: "/admin/academic-import", element: <Navigate to="/admin/academic-data" replace /> },
              { path: "/admin/import", element: <Navigate to="/admin/academic-data" replace /> },
              { path: "/admin/course-sections", element: <Navigate to="/admin/sections" replace /> },
              { path: "/admin/course-opening-plan", element: <Navigate to="/admin/academic-data/advanced/plan" replace /> },
              { path: "/admin/timetable", element: <Navigate to="/admin/scheduling" replace /> },
              { path: "/admin/policies", element: <Navigate to="/admin/attendance" replace /> },
              { path: "/admin/attendance-policy", element: <Navigate to="/admin/attendance" replace /> },
            ],
          },
        ],
      },
    ],
  },
]);
