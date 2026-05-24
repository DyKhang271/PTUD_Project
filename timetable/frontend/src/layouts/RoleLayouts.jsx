import AppShell from "./AppShell";

const studentLinks = [
  { to: "/student/dashboard", label: "Dashboard" },
  { to: "/student/timetable", label: "Thoi khoa bieu" },
  { to: "/student/exams", label: "Lich thi" },
  { to: "/student/attendance", label: "Lich su diem danh" },
];

const teacherLinks = [
  { to: "/teacher/dashboard", label: "Dashboard" },
  { to: "/teacher/sections", label: "Diem danh" },
];

const adminLinks = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/academic-data", label: "Du lieu hoc vu" },
  { to: "/admin/terms", label: "Hoc ky" },
  { to: "/admin/sections", label: "Lop hoc phan" },
  { to: "/admin/scheduling", label: "Lich hoc & thi" },
  { to: "/admin/attendance", label: "Diem danh" },
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
