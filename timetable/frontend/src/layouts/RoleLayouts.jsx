import AppShell from "./AppShell";

const studentLinks = [
  { to: "/student/dashboard", label: "📊 Trang chủ" },
  { to: "/student/timetable", label: "📅 Thời khóa biểu" },
  { to: "/student/exams", label: "📝 Lịch thi" },
  { to: "/student/attendance", label: "🕒 Lịch sử điểm danh" },
];

const teacherLinks = [
  { to: "/teacher/dashboard", label: "📊 Trang chủ" },
  { to: "/teacher/sections", label: "⏱️ Điểm danh" },
];

const adminLinks = [
  { to: "/admin/dashboard", label: "📊 Trang chủ" },
  { to: "/admin/academic-data", label: "🗂️ Dữ liệu học vụ" },
  { to: "/admin/terms", label: "🏫 Quản lý học kỳ" },
  { to: "/admin/sections", label: "🏫 Lớp học phần" },
  { to: "/admin/scheduling", label: "📅 Lịch học & thi" },
  { to: "/admin/attendance", label: "⏱️ Chính sách điểm danh" },
];

export function StudentLayout() {
  return <AppShell title="Khong gian sinh vien" links={studentLinks} />;
}

export function TeacherLayout() {
  return <AppShell title="Khong gian giang vien" links={teacherLinks} />;
}

export function AdminLayout() {
  return <AppShell title="Quan tri timetable" links={adminLinks} />;
}
