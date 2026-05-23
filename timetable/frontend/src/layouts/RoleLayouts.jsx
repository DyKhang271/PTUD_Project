import AppShell from "./AppShell";

const studentLinks = [
  { to: "/student/dashboard", label: "Dashboard" },
  { to: "/student/timetable", label: "Thoi khoa bieu" },
  { to: "/student/exams", label: "Lich thi" },
  { to: "/student/attendance", label: "Diem danh" },
];

const teacherLinks = [
  { to: "/teacher/dashboard", label: "Dashboard" },
  { to: "/teacher/sections", label: "Lop phu trach" },
];

const adminLinks = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/terms", label: "Hoc ky" },
  { to: "/admin/course-sections", label: "Dong bo du lieu" },
  { to: "/admin/course-opening-plan", label: "Ke hoach mo lop" },
  { to: "/admin/timetable", label: "Lich hoc & thi" },
  { to: "/admin/policies", label: "Policy diem danh" },
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
